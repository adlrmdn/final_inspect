import React from 'react';

interface RightDefectPaneProps {
  activeSession: any;
  sessionEditMode: boolean;
  activePackagingProject: any;
  handleMoveVersion: () => void;
  defectImagePathInput: string;
  setDefectImagePathInput: (val: string) => void;
  selectedImageBase64: string;
  setSelectedImageBase64: (val: string) => void;
  defectTypeInput: string;
  setDefectTypeInput: (val: string) => void;
  defectDescInput: string;
  setDefectDescInput: (val: string) => void;
  defectMajorInput: number;
  setDefectMajorInput: React.Dispatch<React.SetStateAction<number>>;
  defectMinorInput: number;
  setDefectMinorInput: React.Dispatch<React.SetStateAction<number>>;
  handleAddTempDefectImage: () => void;
  tempDefectImages: any[];
  setTempDefectImages: React.Dispatch<React.SetStateAction<any[]>>;
  handleUpdateSavedDefect?: (imageId: string, field: 'major' | 'minor', value: number) => Promise<void>;
}

export const RightDefectPane: React.FC<RightDefectPaneProps> = ({
  activeSession,
  sessionEditMode,
  activePackagingProject,
  handleMoveVersion,
  defectImagePathInput,
  setDefectImagePathInput,
  selectedImageBase64,
  setSelectedImageBase64,
  defectTypeInput,
  setDefectTypeInput,
  defectDescInput,
  setDefectDescInput,
  defectMajorInput,
  setDefectMajorInput,
  defectMinorInput,
  setDefectMinorInput,
  handleAddTempDefectImage,
  tempDefectImages,
  setTempDefectImages,
  handleUpdateSavedDefect,
}) => {
  const images = activePackagingProject.defect_images || [];
  const projectImages = images.filter((img: any) => img.project_id === activePackagingProject.project_id);

  const renderSavedProjectDefectImages = () => {
    return projectImages.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {projectImages.map((img: any, idx: number) => {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                background: '#F8FAFC',
                padding: '0.85rem',
                borderRadius: '12px',
                border: '2px solid rgba(15, 23, 42, 0.16)',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
              }}
            >
              {/* Header: Defect Type Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="electric-badge" style={{ fontSize: '0.65rem', padding: '0.2rem 0.55rem', background: 'rgba(37, 99, 235, 0.08)' }}>
                  {img.defect_type}
                </span>
              </div>

              {/* Main Content Area: Image (Left) + Description (Right) */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                {img.image_path && (img.image_path.startsWith('data:image/') || img.image_path.startsWith('http') || img.image_path.length > 50) ? (
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: '#E2E8F0',
                      border: '1.5px solid rgba(15, 23, 42, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    }}
                  >
                    <img src={img.image_path} alt="Defect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.05)',
                      border: '1.5px dashed rgba(15, 23, 42, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'var(--text-muted)',
                      gap: '0.25rem'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>NO IMAGE</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--deep-ocean)', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.35 }}>
                    {img.description || 'No description provided'}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                    Logged: {img.captured_at ? new Date(img.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              </div>

              {/* Steppers: Major / Minor Adjustments */}
              <div style={{ display: 'flex', gap: '0.65rem', borderTop: '1px solid rgba(15, 23, 42, 0.08)', paddingTop: '0.65rem', flexWrap: 'wrap' }}>
                {sessionEditMode ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                      <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)' }}>MAJ</span>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '4px', padding: '1px', flex: 1, justifyContent: 'space-between' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.max(0, img.major - 1);
                            handleUpdateSavedDefect?.(img.image_id, 'major', val);
                          }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '0 0.35rem' }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={img.major === 0 ? '' : img.major ?? ''}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => {
                            const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                            e.target.value = cleanVal;
                            const val = cleanVal === '' ? 0 : parseInt(cleanVal, 10) || 0;
                            handleUpdateSavedDefect?.(img.image_id, 'major', val);
                          }}
                          style={{
                            width: '24px',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            textAlign: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: 0,
                            margin: 0,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = img.major + 1;
                            handleUpdateSavedDefect?.(img.image_id, 'major', val);
                          }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '0 0.35rem' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                      <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)' }}>MIN</span>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '4px', padding: '1px', flex: 1, justifyContent: 'space-between' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.max(0, img.minor - 1);
                            handleUpdateSavedDefect?.(img.image_id, 'minor', val);
                          }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '0 0.35rem' }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={img.minor === 0 ? '' : img.minor ?? ''}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => {
                            const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                            e.target.value = cleanVal;
                            const val = cleanVal === '' ? 0 : parseInt(cleanVal, 10) || 0;
                            handleUpdateSavedDefect?.(img.image_id, 'minor', val);
                          }}
                          style={{
                            width: '24px',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            textAlign: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: 0,
                            margin: 0,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = img.minor + 1;
                            handleUpdateSavedDefect?.(img.image_id, 'minor', val);
                          }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '0 0.35rem' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      className="electric-badge red"
                      style={{
                        fontSize: '0.55rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        flex: 1,
                      }}
                    >
                      Major: {img.major}
                    </span>
                    <span
                      className="electric-badge gold"
                      style={{
                        fontSize: '0.55rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        flex: 1,
                      }}
                    >
                      Minor: {img.minor}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div
        style={{
          padding: '1.5rem',
          border: '2px dashed rgba(15, 23, 42, 0.16)',
          borderRadius: '12px',
          textAlign: 'center',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
        }}
      >
        No defect images logged for this project.
      </div>
    );
  };

  return (
    <div style={{ flex: '30 1 0%', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', gap: '1rem', paddingTop: '6px' }}>
      {activeSession ? (
        <div
          className="bento-card"
          style={{
            padding: '1.25rem',
            background: '#ffffff',
            border: '2px solid rgba(15, 23, 42, 0.16)',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            textAlign: 'left',
            transform: 'none',
            transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(37, 99, 235, 0.08)',
              paddingBottom: '0.45rem',
            }}
          >
            <h4 style={{ fontSize: '0.76rem', fontWeight: 900, color: 'var(--royal-blue)', textTransform: 'uppercase', margin: 0 }}>Defect Photos</h4>
          </div>

          {sessionEditMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div>
                <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                  DEFECT PHOTO
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <input
                    type="file"
                    id="defect-image-picker"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setDefectImagePathInput(file.name);
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setSelectedImageBase64(event.target.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="defect-image-picker"
                    className="btn-electric-outline"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      padding: '0.45rem',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '2px dashed rgba(15, 23, 42, 0.25)',
                      background: 'rgba(15, 23, 42, 0.02)',
                      color: 'var(--deep-ocean)',
                      fontWeight: 700,
                      textAlign: 'center',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    Choose Image File
                  </label>
                  {defectImagePathInput && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                      Selected: <strong>{defectImagePathInput}</strong>
                    </div>
                  )}
                  {selectedImageBase64 && (
                    <div
                      style={{
                        width: '100%',
                        height: '80px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid rgba(37,99,235,0.12)',
                        background: '#F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      <img src={selectedImageBase64} alt="Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedImageBase64('');
                          setDefectImagePathInput('');
                        }}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'rgba(239, 68, 68, 0.85)',
                          color: 'white',
                          border: 'none',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                  DEFECT TYPE
                </label>
                <select
                  value={defectTypeInput}
                  onChange={(e) => setDefectTypeInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.72rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                    background: 'white',
                  }}
                >
                  <option value="Labeling">Labeling</option>
                  <option value="Sewing">Sewing</option>
                  <option value="Packing">Packing</option>
                  <option value="Fabric">Fabric</option>
                  <option value="Artwork">Artwork</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                  DEFECT DESCRIPTION
                </label>
                <textarea
                  placeholder="Enter text description..."
                  value={defectDescInput}
                  onChange={(e) => setDefectDescInput(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.72rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                    resize: 'none',
                    background: 'white',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                <div>
                  <label style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                    MAJOR DEFECTS
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '6px', padding: '1px' }}>
                    <button
                      type="button"
                      onClick={() => setDefectMajorInput((prev) => Math.max(0, prev - 1))}
                      style={{ padding: '0.2rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={defectMajorInput === 0 ? '' : defectMajorInput ?? ''}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                        e.target.value = cleanVal;
                        setDefectMajorInput(cleanVal === '' ? 0 : parseInt(cleanVal, 10) || 0);
                      }}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: 0,
                        margin: 0,
                        width: '100%',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setDefectMajorInput((prev) => prev + 1)}
                      style={{ padding: '0.2rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                    MINOR DEFECTS
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '6px', padding: '1px' }}>
                    <button
                      type="button"
                      onClick={() => setDefectMinorInput((prev) => Math.max(0, prev - 1))}
                      style={{ padding: '0.2rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={defectMinorInput === 0 ? '' : defectMinorInput ?? ''}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                        e.target.value = cleanVal;
                        setDefectMinorInput(cleanVal === '' ? 0 : parseInt(cleanVal, 10) || 0);
                      }}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: 0,
                        margin: 0,
                        width: '100%',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setDefectMinorInput((prev) => prev + 1)}
                      style={{ padding: '0.2rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddTempDefectImage}
                className="btn-electric-outline"
                style={{ padding: '0.4rem', fontSize: '0.7rem', background: '#FFFFFF', borderRadius: '8px', marginTop: '0.25rem', cursor: 'pointer' }}
              >
                Attach Defect Image
              </button>

              {tempDefectImages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.55rem' }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Draft Attachments ({tempDefectImages.length})
                  </span>
                  {tempDefectImages.map((img, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        background: '#F1F5F9',
                        padding: '0.85rem',
                        borderRadius: '12px',
                        border: '2px solid rgba(15, 23, 42, 0.16)',
                        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
                      }}
                    >
                      {/* Header: Defect Type Badge & Delete button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="electric-badge" style={{ fontSize: '0.65rem', padding: '0.2rem 0.55rem', background: 'rgba(37, 99, 235, 0.08)' }}>
                          {img.defect_type} (Draft)
                        </span>
                        <button
                          type="button"
                          onClick={() => setTempDefectImages((prev) => prev.filter((_, i) => i !== idx))}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#EF4444',
                            fontWeight: 900,
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            padding: '0 0.15rem',
                            lineHeight: 1,
                          }}
                          title="Remove Draft Attachment"
                        >
                          &times;
                        </button>
                      </div>

                      {/* Main Content Area: Image + Description */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        {img.image_path && (img.image_path.startsWith('data:image/') || img.image_path.startsWith('http') || img.image_path.length > 50) ? (
                          <div
                            style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              flexShrink: 0,
                              background: '#E2E8F0',
                              border: '1.5px solid rgba(15, 23, 42, 0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                            }}
                          >
                            <img src={img.image_path} alt="Defect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '8px',
                              background: 'rgba(15, 23, 42, 0.05)',
                              border: '1.5px dashed rgba(15, 23, 42, 0.15)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: 'var(--text-muted)',
                              gap: '0.25rem'
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                            <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>NO IMAGE</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--deep-ocean)', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.35 }}>
                            {img.description || 'No description provided'}
                          </div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                            Draft Captured
                          </div>
                        </div>
                      </div>

                      {/* Steppers: Major / Minor Adjustments */}
                      <div style={{ display: 'flex', gap: '0.65rem', borderTop: '1px solid rgba(15, 23, 42, 0.08)', paddingTop: '0.65rem', flexWrap: 'wrap' }}>
                        {sessionEditMode ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                              <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)' }}>MAJ</span>
                              <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '4px', padding: '1px', flex: 1, justifyContent: 'space-between' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = Math.max(0, img.major - 1);
                                    setTempDefectImages(prev => prev.map((item, i) => i === idx ? { ...item, major: val } : item));
                                  }}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '0 0.35rem' }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={img.major === 0 ? '' : img.major ?? ''}
                                  placeholder="0"
                                  onFocus={(e) => e.target.select()}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                    setTempDefectImages(prev => prev.map((item, i) => i === idx ? { ...item, major: val } : item));
                                  }}
                                  style={{
                                    width: '24px',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    textAlign: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: 0,
                                    margin: 0,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = img.major + 1;
                                    setTempDefectImages(prev => prev.map((item, i) => i === idx ? { ...item, major: val } : item));
                                  }}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '0 0.35rem' }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                              <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)' }}>MIN</span>
                              <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '4px', padding: '1px', flex: 1, justifyContent: 'space-between' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = Math.max(0, img.minor - 1);
                                    setTempDefectImages(prev => prev.map((item, i) => i === idx ? { ...item, minor: val } : item));
                                  }}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '0 0.35rem' }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={img.minor === 0 ? '' : img.minor ?? ''}
                                  placeholder="0"
                                  onFocus={(e) => e.target.select()}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                    setTempDefectImages(prev => prev.map((item, i) => i === idx ? { ...item, minor: val } : item));
                                  }}
                                  style={{
                                    width: '24px',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    textAlign: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: 0,
                                    margin: 0,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = img.minor + 1;
                                    setTempDefectImages(prev => prev.map((item, i) => i === idx ? { ...item, minor: val } : item));
                                  }}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '0 0.35rem' }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <span
                              className="electric-badge red"
                              style={{
                                fontSize: '0.55rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                flex: 1,
                              }}
                            >
                              Major: {img.major}
                            </span>
                            <span
                              className="electric-badge gold"
                              style={{
                                fontSize: '0.55rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                flex: 1,
                              }}
                            >
                              Minor: {img.minor}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {projectImages.length > 0 && (
                <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Project Defect Log ({projectImages.length})
                  </span>
                  {renderSavedProjectDefectImages()}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>{renderSavedProjectDefectImages()}</div>
          )}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.78rem',
            border: '2px dashed rgba(37, 99, 235, 0.12)',
            borderRadius: '20px',
            padding: '2rem',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--deep-ocean)',
              marginBottom: '0.85rem',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <span style={{ fontWeight: 800, color: 'var(--deep-ocean)', fontSize: '0.88rem' }}>No Active QC Inspection Version</span>
          <p style={{ fontSize: '0.72rem', maxWidth: '300px', margin: '0.25rem 0 1rem 0', lineHeight: 1.4, textAlign: 'center' }}>
            Select a version from the navigation bar above, or initialize the first version to begin editing quality control data.
          </p>
          {activePackagingProject.status !== 'completed' && (
            <button
              type="button"
              onClick={handleMoveVersion}
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.78rem',
                borderRadius: '12px',
                background: 'var(--royal-blue)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
              }}
            >
              + Start Version 1 (1st Final)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
