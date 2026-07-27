import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getInspectorProfile } from '../../utils/inspector_profile';

// Base URL of the verification web service. Customize this when deploying.
const WEB_SERVICE_URL = 'https://vendor-portal.megaperintis.co.id';

interface WorkspaceControlsProps {
  activePackagingProject: any;
  activeSession: any;
  deletingProjectId: string | null;
  hasNextVersionExists: () => boolean;
  getCycleName: (cycleNum: number) => string;
  handleMoveVersion: () => void;
  handleRemovePackagingProject: (projectId: string) => void;
  setActiveSession: (session: any) => void;
  setSelectedSizeTab: (size: string) => void;
  setSessionEditMode: (mode: boolean) => void;
  headerButtonStyle: React.CSSProperties;
  versionSelectorButtonStyle: (isSelected: boolean) => React.CSSProperties;
  handlePrintReport: () => void;
  handleUploadVerificationDoc: (projectId: string, docBase64: string, silent?: boolean) => Promise<void>;
  showProfessionalAlert: (title: string, msg: string, type?: 'alert' | 'success' | 'danger') => Promise<any>;
  showProfessionalConfirm: (title: string, message: string) => Promise<boolean>;
  isBalanceMatching: boolean;
  handlePartialSyncProject: () => void;
  isOnline: boolean;
  isProcessing: boolean;
  onRefreshProject: () => Promise<void>;
}

export const WorkspaceControls: React.FC<WorkspaceControlsProps> = ({
  activePackagingProject,
  activeSession,
  deletingProjectId,
  hasNextVersionExists,
  getCycleName,
  handleMoveVersion,
  handleRemovePackagingProject,
  setActiveSession,
  setSelectedSizeTab,
  setSessionEditMode,
  headerButtonStyle,
  versionSelectorButtonStyle,
  handlePrintReport,
  handleUploadVerificationDoc,
  showProfessionalAlert,
  showProfessionalConfirm,
  isBalanceMatching,
  handlePartialSyncProject,
  isOnline,
  isProcessing,
  onRefreshProject,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const [showApprovalDetail, setShowApprovalDetail] = useState(false);
  const [showHoApprovalDetail, setShowHoApprovalDetail] = useState(false);
  const [recipientInput, setRecipientInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const isOnlineRef = useRef<boolean>(isOnline);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  // Derived verification state — used both in the Verify button IIFE and to gate Complete & Sync.
  const isStage1Done = !!(activeSession && (
    activeSession.approval_status === 'approved' ||
    (activeSession.approval_signature && activeSession.approval_signature.toLowerCase().includes('digitally signed'))
  ));
  // Stage 2 (HO) writes either 'Digitally Signed:...' or 'Rejected:...' into ho_approval_signature.
  // Check the content, not just presence, so a rejection doesn't count as approved.
  const isStage2Done = !!(activeSession?.ho_approval_signature?.includes('Digitally Signed:'));
  const isHoRejected = !!(activeSession?.ho_approval_signature?.includes('Rejected:'));
  // Stage 3 (Director) — same prefix contract on director_approval_signature. A Director
  // rejection also CLEARS ho_approval_signature (back to MD Production, NOT back to QC),
  // so isDirectorRejected + !isStage2Done = waiting for MD Production to re-approve.
  const directorSig: string = activeSession?.director_approval_signature || '';
  const isStage3Done = directorSig.includes('Digitally Signed:');
  const isDirectorRejected = directorSig.includes('Rejected:');
  const isFullyVerified = isStage1Done && isStage2Done;

  // NOTE (dynamic verified_doc): the console no longer regenerates/uploads the
  // signed PDF when the HO signature appears. The portal re-renders the report
  // server-side at EVERY workflow transition (approve/reject at each stage, and
  // on-demand when the document is viewed) and pushes it into
  // packaging_projects.verified_doc — the console just displays that column.
  // The only console write left is the initial upload at Verify → Send, so the
  // very first email has an attachment before any portal milestone exists.

  const handleSendEmail = async () => {
    if (!isOnlineRef.current) {
      await showProfessionalAlert('Offline', 'You must be online to send the verification email.', 'danger');
      return;
    }
    const email = recipientInput.trim();
    if (!email || !subjectInput.trim()) return;

    // Validate single email address format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await showProfessionalAlert(
        'Invalid Email',
        'Please enter exactly one valid email address (e.g. manager@megaperintis.co.id). Multiple addresses or commas are not allowed.',
        'danger'
      );
      return;
    }

    setIsSendingEmail(true);
    try {
      // Generate a secure single-use UUID token and store it in the database with the intended signer's email.
      // The device-registered inspector profile is stamped on too, so the portal can notify
      // the inspector on rejections (back-to-QC) and on completion.
      const inspectorProfile = getInspectorProfile();
      const token = crypto.randomUUID();
      await invoke('save_session_approval_info', {
        projectId: activePackagingProject.project_id,
        sessionId: activeSession.session_id,
        approvalToken: token,
        approvalEmail: email,
        inspectorName: inspectorProfile?.name || null,
        inspectorEmail: inspectorProfile?.email || null
      });

      // 1. Fetch the PDF dynamically from the web service.
      let reportPdfBase64 = '';
      try {
        const response = await fetch(`${WEB_SERVICE_URL}/qc/print/${activePackagingProject.project_id}/${activeSession.session_id}`);
        if (response.ok) {
          const blob = await response.blob();
          reportPdfBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          console.warn('Failed to fetch PDF from web service:', response.statusText);
        }
      } catch (err) {
        console.error('Error fetching PDF from web service:', err);
      }
      
      const attachmentData = reportPdfBase64 || activePackagingProject.verified_doc || null;

      if (!attachmentData) {
        await showProfessionalAlert(
          'Attachment Required',
          'Could not generate or find the inspection report PDF attachment.',
          'danger'
        );
        setIsSendingEmail(false);
        return;
      }

      // We do not save the unsigned PDF to the DB here. The verified_doc in the DB will only be
      // populated with the fully signed/approved PDF upon approval or during project completion.

      // Clean cover email to prevent corporate spam blocks and include Approve/Reject options
      const emailCoverHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333333; line-height: 1.6;">
          <div style="background-color: #1e3a8a; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px; font-weight: bold; text-align: center;">Quality Control Inspection</h2>
          </div>
          <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
            <p>Dear Team,</p>
            <p>Please find attached the official Quality Control inspection report document for style <strong>${activePackagingProject.article_name}</strong>.</p>
            
             <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
              <tr>
                <td style="width: 35%; font-weight: bold; padding: 6px 0; color: #475569;">Style Name:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #1e293b;">${activePackagingProject.article_name}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 6px 0; color: #475569;">Season:</td>
                <td style="padding: 6px 0;">${activePackagingProject.season || '—'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 6px 0; color: #475569;">PO Info:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #1e293b;">${activePackagingProject.po_info || '—'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 6px 0; color: #475569;">Vendor:</td>
                <td style="padding: 6px 0;">${activePackagingProject.po_vendor || '—'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 6px 0; color: #475569;">Inspection Result:</td>
                <td style="padding: 6px 0; font-weight: bold; color: ${(activeSession.result || '').toLowerCase() === 'passed' ? '#10B981' : ((activeSession.result || '').toLowerCase() === 'failed' ? '#EF4444' : '#D97706')};">
                  ${(activeSession.result || 'pending').toUpperCase()}
                </td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 6px 0; color: #475569;">Inspector:</td>
                <td style="padding: 6px 0;">${activeSession.inspector || '—'}</td>
              </tr>
            </table>
            
            <p>The detailed matrix and checklist items are included in the attached verification report file.</p>
            <p style="margin-top: 15px; font-weight: bold; color: #0F172A;">Please review the details and confirm the inspection by clicking one of the buttons below:</p>
            <div style="margin: 25px 0; text-align: center;">
              <a href="${WEB_SERVICE_URL}/qc/approve/${token}" 
                 style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; margin-right: 12px; display: inline-block;">
                ✓ Approve & Sign
              </a>
              <a href="${WEB_SERVICE_URL}/qc/reject/${token}" 
                 style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                ✗ Reject
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
            <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0;">This email was sent automatically from Final Inspection QC System.</p>
          </div>
        </div>
      `;

      const cleanArticleName = activePackagingProject.article_name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const versionCycle = getCycleName(activeSession.cycle_number).replace(/\s+/g, '_');
      const attFilename = `QC_Report_${cleanArticleName}_${versionCycle}`;

      // Save verified_doc before sending so portal can always attach it to HO chain email,
      // regardless of whether the console stays running after Stage 1.
      await handleUploadVerificationDoc(activePackagingProject.project_id, attachmentData, true);

      try {
        await invoke('send_email_report', {
          recipient: email,
          subject: subjectInput.trim(),
          htmlBody: emailCoverHtml,
          attachmentBody: attachmentData,
          attachmentFilename: attFilename
        });
      } catch (smtpErr) {
        // Local SMTP (port 587) can be firewalled or time out on some networks.
        // Fall back to the web service, which dispatches the email server-side.
        console.warn('Direct SMTP dispatch failed, falling back to web service:', smtpErr);
        const fallbackResponse = await fetch(`${WEB_SERVICE_URL}/api/qc/send-verification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: email,
            subject: subjectInput.trim(),
            html_body: emailCoverHtml,
            attachment_body: attachmentData,
            attachment_filename: attFilename
          })
        });
        if (!fallbackResponse.ok) {
          throw new Error(`Both direct SMTP and web service dispatch failed: ${fallbackResponse.statusText}`);
        }
      }
      setIsSendEmailOpen(false);
      await showProfessionalAlert(
        'Email Dispatched',
        'The inspection report with the PDF document attachment has been successfully sent for verification.',
        'success'
      );
      await onRefreshProject();
    } catch (e: any) {
      console.error('Failed to send email:', e);
      await showProfessionalAlert('Send Failed', `Could not dispatch email: ${e.message || e}`, 'danger');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div
      className="flex-between"
      style={{
        borderBottom: '2px solid rgba(15, 23, 42, 0.16)',
        paddingBottom: '0.75rem',
        marginBottom: '0.75rem',
        width: '100%',
        flexShrink: 0,
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      {/* Left Side: Version Selectors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--text-muted)',
            marginRight: '0.45rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          QC WORKSPACE VERSION:
        </span>
        {(() => {
          const visibleSessions = (activePackagingProject.sessions || [])
            .filter((s: any) => s.cycle_number >= 1)
            .sort((a: any, b: any) => a.cycle_number - b.cycle_number);

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              {visibleSessions.map((ses: any) => {
                const isSelected = activeSession && activeSession.session_id === ses.session_id;
                return (
                  <button
                    key={ses.session_id}
                    type="button"
                    onClick={() => {
                      setActiveSession(ses);
                      setSessionEditMode(false);
                      if (ses.report_lines && ses.report_lines.length > 0) {
                        setSelectedSizeTab(ses.report_lines[0].size_val || '');
                      }
                    }}
                    className={isSelected ? 'btn-electric' : 'btn-electric-outline'}
                    style={versionSelectorButtonStyle(isSelected)}
                  >
                    {getCycleName(ses.cycle_number)}
                  </button>
                );
              })}

              {/* + Next Version Button placed inline right after versions */}
              {activePackagingProject.status !== 'completed' &&
                (activeSession ? (
                  !hasNextVersionExists() &&
                  activeSession.cycle_number >= 1 &&
                  activeSession.cycle_number <= 3 && (
                    <button
                      type="button"
                      onClick={handleMoveVersion}
                      style={{
                        ...headerButtonStyle,
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '2px solid rgba(16, 185, 129, 0.4)',
                        color: '#10B981',
                        gap: '0.25rem',
                      }}
                    >
                      + Next Version
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleMoveVersion}
                    style={{
                      ...headerButtonStyle,
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '2px solid rgba(16, 185, 129, 0.4)',
                      color: '#10B981',
                      gap: '0.25rem',
                    }}
                  >
                    + Start Version 1
                  </button>
                ))}
            </div>
          );
        })()}
      </div>

      {/* Right Side: Workspace Control Panel */}
      <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--royal-blue)',
            marginRight: '0.45rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          ACTION:
        </span>

        {deletingProjectId === activePackagingProject.project_id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: '#EF4444', padding: '0.45rem 1.15rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: '2px solid rgba(239, 68, 68, 0.2)',
                borderTopColor: '#EF4444',
                animation: 'spin-sync 1s linear infinite',
              }}
            />
            Removing Workspace...
          </div>
        ) : (
          <>
            {/* 1. Report */}
            {activeSession && (
              <button
                className="btn-electric-outline"
                onClick={handlePrintReport}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 0.85rem',
                  fontSize: '0.72rem',
                  color: 'var(--royal-blue)',
                  borderColor: 'rgba(37, 99, 235, 0.28)',
                  background: 'rgba(37, 99, 235, 0.05)',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                  gap: '0.25rem',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Report
              </button>
            )}

            {/* Verify / Verified Digital Signature flow */}
            {(() => {
              const isRejected = activeSession?.approval_status === 'rejected';
              const isAwaitingStage1 = !isStage1Done && !isRejected && !!(activeSession?.approval_token);

              if (isFullyVerified) {
                // Stage 1 + 2 signed. Stage 3 (Director) decides the final label:
                // signed → fully Verified; otherwise the Director email is out.
                return (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {!isStage3Done && (
                      <span
                        style={{
                          height: '32px',
                          boxSizing: 'border-box',
                          padding: '0 0.85rem',
                          fontSize: '0.72rem',
                          color: '#6366F1',
                          border: '1.5px solid rgba(99, 102, 241, 0.35)',
                          background: 'rgba(99, 102, 241, 0.06)',
                          fontWeight: 800,
                          borderRadius: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: '1',
                          gap: '0.25rem',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Pending Director Authorization
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn-electric-outline"
                      onClick={() => setShowPreview(true)}
                      style={{
                        height: '32px',
                        boxSizing: 'border-box',
                        width: 'auto',
                        padding: '0 0.85rem',
                        fontSize: '0.72rem',
                        color: '#10B981',
                        borderColor: 'rgba(16, 185, 129, 0.28)',
                        background: 'rgba(16, 185, 129, 0.05)',
                        fontWeight: 800,
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: '1',
                        gap: '0.25rem',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      {isStage3Done ? 'Fully Verified' : 'Verified'}
                    </button>
                  </div>
                );
              } else if (isDirectorRejected && isStage1Done && !isStage2Done) {
                // Director sent it back to MD Production: the HO signature was cleared,
                // the factory confirmation stands. Nothing for QC to redo — read-only wait.
                return (
                  <span
                    style={{
                      height: '32px',
                      boxSizing: 'border-box',
                      padding: '0 0.85rem',
                      fontSize: '0.72rem',
                      color: '#D97706',
                      border: '1.5px solid rgba(217, 119, 6, 0.35)',
                      background: 'rgba(217, 119, 6, 0.06)',
                      fontWeight: 800,
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1',
                      gap: '0.25rem',
                    }}
                    title="The Director rejected the inspection and returned it to MD Production for re-approval. The factory confirmation is kept."
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 14 4 9 9 4" />
                      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                    </svg>
                    Returned by Director — Pending MD Prod
                  </span>
                );
              } else if (isHoRejected) {
                const canReVerify = isOnline && !isProcessing;
                return (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        height: '32px',
                        boxSizing: 'border-box',
                        padding: '0 0.85rem',
                        fontSize: '0.72rem',
                        color: '#EF4444',
                        border: '1.5px solid rgba(239, 68, 68, 0.35)',
                        background: 'rgba(239, 68, 68, 0.06)',
                        fontWeight: 800,
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: '1',
                        gap: '0.25rem',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      HO Rejected
                    </span>
                    <button
                      type="button"
                      className="btn-electric-outline"
                      disabled={!canReVerify}
                      onClick={() => {
                        setRecipientInput('');
                        setSubjectInput(`[Inspection Report] ${activePackagingProject.article_name} - Version ${getCycleName(activeSession.cycle_number)}`);
                        setIsSendEmailOpen(true);
                      }}
                      title={!isOnline ? 'You must be online to re-verify.' : 'Re-send verification email from stage 1. HO approval is also reset.'}
                      style={{
                        height: '32px',
                        boxSizing: 'border-box',
                        width: 'auto',
                        padding: '0 0.85rem',
                        fontSize: '0.72rem',
                        color: canReVerify ? 'var(--royal-blue)' : 'var(--text-muted)',
                        borderColor: canReVerify ? 'rgba(37, 99, 235, 0.28)' : 'rgba(15, 23, 42, 0.16)',
                        background: canReVerify ? 'rgba(37, 99, 235, 0.05)' : 'rgba(15, 23, 42, 0.04)',
                        fontWeight: 800,
                        borderRadius: '10px',
                        cursor: canReVerify ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: '1',
                        gap: '0.25rem',
                        opacity: canReVerify ? 1 : 0.5,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                      </svg>
                      Re-verify
                    </button>
                  </div>
                );
              } else if (isStage1Done) {
                return (
                  <button
                    type="button"
                    onClick={() => setShowHoApprovalDetail(true)}
                    style={{
                      height: '32px',
                      boxSizing: 'border-box',
                      padding: '0 0.85rem',
                      fontSize: '0.72rem',
                      color: '#D97706',
                      border: '1.5px solid rgba(217, 119, 6, 0.35)',
                      background: 'rgba(217, 119, 6, 0.06)',
                      fontWeight: 800,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1',
                      gap: '0.25rem',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Pending HO Approval
                  </button>
                );
              } else if (isAwaitingStage1) {
                return (
                  <button
                    type="button"
                    onClick={() => setShowApprovalDetail(true)}
                    style={{
                      height: '32px',
                      boxSizing: 'border-box',
                      padding: '0 0.85rem',
                      fontSize: '0.72rem',
                      color: '#6366F1',
                      border: '1.5px solid rgba(99, 102, 241, 0.35)',
                      background: 'rgba(99, 102, 241, 0.06)',
                      fontWeight: 800,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1',
                      gap: '0.25rem',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Awaiting Approval
                  </button>
                );
              } else if (isRejected && activeSession && activePackagingProject.status !== 'completed') {
                const canResend = isOnline && isBalanceMatching && !isProcessing;
                return (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn-electric-outline"
                      disabled={!canResend}
                      onClick={() => {
                        setRecipientInput('');
                        setSubjectInput(`[Inspection Report] ${activePackagingProject.article_name} - Version ${getCycleName(activeSession.cycle_number)}`);
                        setIsSendEmailOpen(true);
                      }}
                      title={!isOnline ? 'You must be online to re-verify.' : !isBalanceMatching ? 'Balance must match cutting qty to verify.' : undefined}
                      style={{
                        height: '32px',
                        boxSizing: 'border-box',
                        width: 'auto',
                        padding: '0 0.85rem',
                        fontSize: '0.72rem',
                        color: canResend ? 'var(--royal-blue)' : 'var(--text-muted)',
                        borderColor: canResend ? 'rgba(37, 99, 235, 0.28)' : 'rgba(15, 23, 42, 0.16)',
                        background: canResend ? 'rgba(37, 99, 235, 0.05)' : 'rgba(15, 23, 42, 0.04)',
                        fontWeight: 800,
                        borderRadius: '10px',
                        cursor: canResend ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: '1',
                        gap: '0.25rem',
                        opacity: canResend ? 1 : 0.5,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                      </svg>
                      Re-verify
                    </button>
                  </div>
                );
              } else if (activeSession && activePackagingProject.status !== 'completed') {
                return (
                  <button
                    type="button"
                    className="btn-electric-outline"
                    disabled={!isOnline || !isBalanceMatching || isProcessing}
                    onClick={() => {
                      setRecipientInput('');
                      setSubjectInput(`[Inspection Report] ${activePackagingProject.article_name} - Version ${getCycleName(activeSession.cycle_number)}`);
                      setIsSendEmailOpen(true);
                    }}
                    title={!isOnline ? 'You must be online to verify.' : !isBalanceMatching ? 'Balance must match cutting qty (cutting = good + reject) to verify.' : undefined}
                    style={{
                      height: '32px',
                      boxSizing: 'border-box',
                      width: 'auto',
                      padding: '0 0.85rem',
                      fontSize: '0.72rem',
                      color: (!isOnline || !isBalanceMatching || isProcessing) ? 'var(--text-muted)' : 'var(--royal-blue)',
                      borderColor: (!isOnline || !isBalanceMatching || isProcessing) ? 'rgba(15, 23, 42, 0.16)' : 'rgba(37, 99, 235, 0.28)',
                      background: (!isOnline || !isBalanceMatching || isProcessing) ? 'rgba(15, 23, 42, 0.04)' : 'rgba(37, 99, 235, 0.05)',
                      fontWeight: 800,
                      borderRadius: '10px',
                      cursor: (!isOnline || !isBalanceMatching || isProcessing) ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1',
                      gap: '0.25rem',
                      opacity: (!isOnline || !isBalanceMatching || isProcessing) ? 0.5 : 1,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Verify
                  </button>
                );
              }
              return null;
            })()}

            {/* 3. Completion status / Partial Sync — manual "Complete & Sync" is GONE:
                the portal completes the project (and queues invoice/deduction/RAF RPA)
                when the Director approves. */}
            {activePackagingProject.status !== 'completed' ? (
              isBalanceMatching ? (
                null
              ) : (
                <button
                  className="btn-electric-outline"
                  onClick={handlePartialSyncProject}
                  disabled={!isOnline || isProcessing}
                  title={!isOnline ? 'You must be online to sync.' : undefined}
                  style={{
                    height: '32px',
                    boxSizing: 'border-box',
                    width: 'auto',
                    padding: '0 0.85rem',
                    fontSize: '0.72rem',
                    color: (!isOnline || isProcessing) ? 'var(--text-muted)' : 'var(--royal-blue)',
                    borderColor: (!isOnline || isProcessing) ? 'rgba(15, 23, 42, 0.16)' : 'rgba(37, 99, 235, 0.28)',
                    background: (!isOnline || isProcessing) ? 'rgba(15, 23, 42, 0.04)' : 'rgba(37, 99, 235, 0.05)',
                    fontWeight: 800,
                    borderRadius: '10px',
                    cursor: (!isOnline || isProcessing) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1',
                    opacity: (!isOnline || isProcessing) ? 0.5 : 1,
                  }}
                >
                  Sync Partial RAF
                </button>
              )
            ) : (
              <span
                className="electric-badge emerald"
                title="Completed automatically when the Director authorized the inspection."
                style={{
                  fontSize: '0.72rem',
                  height: '32px',
                  boxSizing: 'border-box',
                  padding: '0 0.85rem',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 'normal',
                }}
              >
                ✓ Completed — Director Authorized
              </span>
            )}

            {/* 4. Remove */}
            <button
              className="btn-electric-outline"
              onClick={() => handleRemovePackagingProject(activePackagingProject.project_id)}
              style={{
                height: '32px',
                boxSizing: 'border-box',
                width: 'auto',
                padding: '0 0.85rem',
                fontSize: '0.72rem',
                color: '#EF4444',
                borderColor: 'rgba(239, 68, 68, 0.28)',
                fontWeight: 800,
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: '1',
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>

      {/* Verification Doc Preview Modal */}
      {showPreview && activePackagingProject.verified_doc && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '2rem',
          }} 
          onClick={() => setShowPreview(false)}
        >
          <div 
            style={{
              position: 'relative',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '800px',
              maxWidth: '90%',
              maxHeight: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>Verification Document</h3>
              <button 
                type="button" 
                onClick={() => setShowPreview(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  color: '#64748B',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ overflow: 'auto', display: 'flex', justifyContent: 'center', background: '#F8FAFC', borderRadius: '8px', padding: '0.5rem' }}>
              {activePackagingProject.verified_doc.startsWith('data:application/pdf') ? (
                <iframe 
                  src={activePackagingProject.verified_doc} 
                  title="Verification PDF"
                  style={{ width: '100%', height: '55vh', border: 'none', borderRadius: '6px' }} 
                />
              ) : (
                <img 
                  src={activePackagingProject.verified_doc} 
                  alt="Verification Doc" 
                  style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain', borderRadius: '6px' }} 
                />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(15, 23, 42, 0.08)', paddingTop: '0.75rem' }}>
              {activePackagingProject.status !== 'completed' && <button
                type="button"
                className="btn-electric-outline"
                title="Reset verification status to re-send approval email"
                onClick={async () => {
                  const confirmReset = await showProfessionalConfirm(
                    'Reset Verification Status',
                    'Are you sure you want to reset the verification status for this session? This will clear the representative signature, reset the status, and allow you to re-send the verification email.'
                  );
                  if (confirmReset) {
                    try {
                      await invoke('reset_session_approval_info', {
                        projectId: activePackagingProject.project_id,
                        sessionId: activeSession.session_id
                      });
                      setShowPreview(false);
                      await invoke('save_project_verification_doc', {
                        projectId: activePackagingProject.project_id,
                        docBase64: ''
                      });
                      await onRefreshProject();
                    } catch (e) {
                      await showProfessionalAlert('Recall Failed', String(e), 'danger');
                    }
                  }
                }}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 0.85rem',
                  fontSize: '0.72rem',
                  color: '#ef4444',
                  borderColor: 'rgba(239, 68, 68, 0.28)',
                  background: 'rgba(239, 68, 68, 0.03)',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Reset Verification
              </button>}
              <button
                type="button"
                className="btn-electric"
                onClick={() => setShowPreview(false)}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 1.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: 'var(--royal-blue)',
                  color: '#ffffff',
                  border: 'none',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Dispatcher Modal */}
      {showApprovalDetail && activeSession && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '2rem',
          }}
          onClick={() => setShowApprovalDetail(false)}
        >
          <div
            style={{
              position: 'relative',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '420px',
              maxWidth: '95%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>Approval Pending</h3>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Awaiting digital signature from approver</span>
              </div>
              <button
                type="button"
                onClick={() => setShowApprovalDetail(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 'bold', color: '#64748B' }}
              >✕</button>
            </div>

            {/* Detail rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent To</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{activeSession.approval_email || '—'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{getCycleName(activeSession.cycle_number)} — {activePackagingProject.article_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1.5px solid rgba(99,102,241,0.18)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366F1' }}>Link sent — waiting for the approver to sign digitally.</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', borderTop: '1px solid rgba(15,23,42,0.08)', paddingTop: '0.85rem' }}>
              <button
                type="button"
                onClick={() => setShowApprovalDetail(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.72rem', fontWeight: 700, border: '1.5px solid rgba(15,23,42,0.15)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={!isOnline || isProcessing}
                onClick={async () => {
                  try {
                    await invoke('reset_session_approval_info', {
                      projectId: activePackagingProject.project_id,
                      sessionId: activeSession.session_id,
                    });
                    setShowApprovalDetail(false);
                    await onRefreshProject();
                  } catch (e) {
                    await showProfessionalAlert('Recall Failed', String(e), 'danger');
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  border: '1.5px solid rgba(217,119,6,0.35)',
                  borderRadius: '8px',
                  background: isOnline && !isProcessing ? 'rgba(217,119,6,0.07)' : 'rgba(15,23,42,0.04)',
                  color: isOnline && !isProcessing ? '#D97706' : 'var(--text-muted)',
                  cursor: isOnline && !isProcessing ? 'pointer' : 'not-allowed',
                  opacity: isOnline && !isProcessing ? 1 : 0.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                </svg>
                Recall
              </button>
            </div>
          </div>
        </div>
      )}

      {showHoApprovalDetail && activeSession && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '2rem',
          }}
          onClick={() => setShowHoApprovalDetail(false)}
        >
          <div
            style={{
              position: 'relative',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '420px',
              maxWidth: '95%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>Pending HO Approval</h3>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Awaiting digital signature from MPG HO - MD Production</span>
              </div>
              <button type="button" onClick={() => setShowHoApprovalDetail(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 'bold', color: '#64748B' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stage 1 Approver</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{activeSession.approval_email || '—'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{getCycleName(activeSession.cycle_number)} — {activePackagingProject.article_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(217,119,6,0.06)', border: '1.5px solid rgba(217,119,6,0.2)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706' }}>Stage 1 signed — waiting for HO to sign digitally.</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', borderTop: '1px solid rgba(15,23,42,0.08)', paddingTop: '0.85rem' }}>
              <button type="button" onClick={() => setShowHoApprovalDetail(false)} style={{ padding: '0.5rem 1rem', fontSize: '0.72rem', fontWeight: 700, border: '1.5px solid rgba(15,23,42,0.15)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Close
              </button>
              <button
                type="button"
                disabled={!isOnline || isProcessing}
                onClick={async () => {
                  try {
                    await invoke('reset_session_approval_info', {
                      projectId: activePackagingProject.project_id,
                      sessionId: activeSession.session_id,
                    });
                    setShowHoApprovalDetail(false);
                    await onRefreshProject();
                  } catch (e) {
                    await showProfessionalAlert('Recall Failed', String(e), 'danger');
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  border: '1.5px solid rgba(217,119,6,0.35)',
                  borderRadius: '8px',
                  background: isOnline && !isProcessing ? 'rgba(217,119,6,0.07)' : 'rgba(15,23,42,0.04)',
                  color: isOnline && !isProcessing ? '#D97706' : 'var(--text-muted)',
                  cursor: isOnline && !isProcessing ? 'pointer' : 'not-allowed',
                  opacity: isOnline && !isProcessing ? 1 : 0.5,
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                </svg>
                Recall
              </button>
            </div>
          </div>
        </div>
      )}

      {isSendEmailOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '2rem',
          }} 
          onClick={() => { if (!isSendingEmail) setIsSendEmailOpen(false); }}
        >
          <div 
            style={{
              position: 'relative',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '460px',
              maxWidth: '95%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>Send Verification Email</h3>
              <button 
                type="button" 
                disabled={isSendingEmail}
                onClick={() => setIsSendEmailOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: isSendingEmail ? 'default' : 'pointer',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  color: '#64748B',
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--deep-ocean)', marginBottom: '0.35rem', textAlign: 'left' }}>
                  RECIPIENT EMAIL ADDRESS
                </label>
                <input
                  type="text"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  disabled={isSendingEmail}
                  placeholder="e.g. manager@megaperintis.co.id"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.76rem',
                    border: '1.5px solid rgba(15, 23, 42, 0.15)',
                    borderRadius: '8px',
                    outline: 'none',
                    background: '#FFFFFF',
                  }}
                />
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem', textAlign: 'left' }}>
                  * Enter exactly one email address for digital signature confirmation.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--deep-ocean)', marginBottom: '0.35rem', textAlign: 'left' }}>
                  EMAIL SUBJECT
                </label>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  disabled={isSendingEmail}
                  placeholder="Subject"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.76rem',
                    border: '1.5px solid rgba(15, 23, 42, 0.15)',
                    borderRadius: '8px',
                    outline: 'none',
                    background: '#FFFFFF',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid rgba(15, 23, 42, 0.08)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                disabled={isSendingEmail}
                onClick={() => setIsSendEmailOpen(false)}
                className="btn-electric-outline"
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 0.85rem',
                  fontSize: '0.72rem',
                  color: 'var(--royal-blue)',
                  borderColor: 'rgba(37, 99, 235, 0.28)',
                  background: 'rgba(37, 99, 235, 0.05)',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: isSendingEmail ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingEmail || !recipientInput.trim() || !subjectInput.trim()}
                onClick={handleSendEmail}
                className="btn-electric"
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 1.2rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: (isSendingEmail || !recipientInput.trim() || !subjectInput.trim()) ? 'default' : 'pointer',
                  background: 'var(--royal-blue)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {isSendingEmail ? (
                  <>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        border: '2px solid rgba(255, 255, 255, 0.2)',
                        borderTopColor: '#FFFFFF',
                        animation: 'spin-sync 1s linear infinite',
                      }}
                    />
                    Sending...
                  </>
                ) : (
                  'Send Email'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
