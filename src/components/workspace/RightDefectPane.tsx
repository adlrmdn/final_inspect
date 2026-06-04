import React from 'react';

interface RightDefectPaneProps {
  activeSession: any;
  sessionEditMode: boolean;
  activePackagingProject: any;
  getCycleNameFromSessionId: (sessionId: string, sessions: any[]) => string;
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
}

export const RightDefectPane: React.FC<RightDefectPaneProps> = ({
  activeSession,
  sessionEditMode,
  activePackagingProject,
  getCycleNameFromSessionId,
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
}) => {
  const images = activePackagingProject.defect_images || [];
  const projectImages = images.filter((img: any) => img.project_id === activePackagingProject.project_id);

  const renderSavedProjectDefectImages = () => {
    return projectImages.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {projectImages.map((img: any, idx: number) => {
          const cycleTag = getCycleNameFromSessionId(img.session_id || '', activePackagingProject.sessions || []);
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                background: '#F8FAFC',
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid rgba(37,99,235,0.05)',
              }}
            >
              {img.image_path && (img.image_path.startsWith('data:image/') || img.image_path.startsWith('http') || img.image_path.length > 100) ? (
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: '#E2E8F0',
                    border: '1px solid rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img src={img.image_path} alt="Defect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '4px',
                    background: 'rgba(37, 99, 235, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    flexShrink: 0,
                  }}
                >
                  📷
                </div>
              )}
              <div style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--royal-blue)' }}>[{img.defect_type}]</span>
                  <span
                    className="electric-badge silver"
                    style={{
                      fontSize: '0.5rem',
                      height: '14px',
                      padding: '0 0.35rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 'normal',
                      transform: 'scale(0.9)',
                      transformOrigin: 'left center'
                    }}
                  >
                    {cycleTag}
                  </span>
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--deep-ocean)', display: 'block', marginTop: '0.1rem' }}>
                  {img.description || 'No description'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                <span
                  className="electric-badge red"
                  style={{
                    fontSize: '0.45rem',
                    height: '14px',
                    padding: '0 0.3rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 'normal',
                  }}
                >
                  Maj: {img.major}
                </span>
                <span
                  className="electric-badge gold"
                  style={{
                    fontSize: '0.45rem',
                    height: '14px',
                    padding: '0 0.3rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 'normal',
                  }}
                >
                  Min: {img.minor}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div
        style={{
          padding: '1.5rem',
          border: '1.5px dashed rgba(37,99,235,0.08)',
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
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(37, 99, 235, 0.12)',
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
            <span
              className="electric-badge silver"
              style={{
                fontSize: '0.55rem',
                height: '18px',
                padding: '0 0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 'normal',
              }}
            >
              Cycle {activeSession.cycle_number}
            </span>
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
                      border: '1.5px dashed rgba(37,99,235,0.25)',
                      background: 'rgba(37,99,235,0.02)',
                      color: 'var(--royal-blue)',
                      fontWeight: 700,
                      textAlign: 'center',
                    }}
                  >
                    📷 Choose Image File
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
                    border: '1.5px solid rgba(37,99,235,0.12)',
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
                    border: '1.5px solid rgba(37,99,235,0.12)',
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
                  <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid rgba(37,99,235,0.12)', borderRadius: '6px', padding: '0.15rem' }}>
                    <button
                      type="button"
                      onClick={() => setDefectMajorInput((prev) => Math.max(0, prev - 1))}
                      style={{ padding: '0.05rem 0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800 }}
                    >
                      -
                    </button>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', fontWeight: 800 }}>{defectMajorInput}</span>
                    <button
                      type="button"
                      onClick={() => setDefectMajorInput((prev) => prev + 1)}
                      style={{ padding: '0.05rem 0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800 }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                    MINOR DEFECTS
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid rgba(37,99,235,0.12)', borderRadius: '6px', padding: '0.15rem' }}>
                    <button
                      type="button"
                      onClick={() => setDefectMinorInput((prev) => Math.max(0, prev - 1))}
                      style={{ padding: '0.05rem 0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800 }}
                    >
                      -
                    </button>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', fontWeight: 800 }}>{defectMinorInput}</span>
                    <button
                      type="button"
                      onClick={() => setDefectMinorInput((prev) => prev + 1)}
                      style={{ padding: '0.05rem 0.25rem', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800 }}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.55rem' }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Draft Attachments ({tempDefectImages.length})
                  </span>
                  {tempDefectImages.map((img, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        background: '#F1F5F9',
                        padding: '0.45rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(37,99,235,0.05)',
                      }}
                    >
                      {img.image_path &&
                        (img.image_path.startsWith('data:image/') || img.image_path.startsWith('http') || img.image_path.length > 100) && (
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              flexShrink: 0,
                              background: '#E2E8F0',
                              border: '1px solid rgba(0,0,0,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img src={img.image_path} alt="Defect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                      <div style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--royal-blue)', display: 'block' }}>[{img.defect_type}]</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--deep-ocean)' }}>{img.description || 'No description'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <span
                          className="electric-badge red"
                          style={{
                            fontSize: '0.45rem',
                            height: '14px',
                            padding: '0 0.3rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 'normal',
                          }}
                        >
                          Maj: {img.major}
                        </span>
                        <span
                          className="electric-badge gold"
                          style={{
                            fontSize: '0.45rem',
                            height: '14px',
                            padding: '0 0.3rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 'normal',
                          }}
                        >
                          Min: {img.minor}
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
                            fontSize: '0.8rem',
                            padding: '0 0.15rem',
                            marginLeft: '0.2rem',
                          }}
                        >
                          &times;
                        </button>
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
              background: 'rgba(37, 99, 235, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--royal-blue)',
              marginBottom: '0.85rem',
            }}
          >
            ⚙
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
