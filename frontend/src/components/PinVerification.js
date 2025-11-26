import React, { useState } from 'react';

const PinVerification = ({ onVerify, onCancel, action = 'perform this action' }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!pin) {
      setError('PIN is required');
      return;
    }

    // Let the backend validate the PIN via API (parent will use the value)
    onVerify(pin);
    setPin('');
  };

  const handleCancel = () => {
    setPin('');
    setError('');
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>🔒 PIN Verification Required</h2>
          <span className="close" onClick={handleCancel}>&times;</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px' }}>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Please enter your PIN to {action}.
            </p>
            <div className="form-group">
              <label>PIN *</label>
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="Enter PIN"
                autoFocus
                style={{
                  fontSize: '18px',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  padding: '12px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
                maxLength="10"
              />
            </div>
            {error && (
              <div style={{
                padding: '10px',
                background: '#ffebee',
                color: '#c62828',
                borderRadius: '4px',
                marginBottom: '15px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}
            <div style={{ 
              fontSize: '12px', 
              color: '#999', 
              marginTop: '10px',
              textAlign: 'center'
            }}>
              {/* Default PIN: 1234 (Change via localStorage: app_pin) */}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '0 20px 20px' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Verify
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinVerification;

