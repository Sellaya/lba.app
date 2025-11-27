import * as React from 'react';

interface PasswordResetEmailProps {
  resetLink: string;
}

const main = {
  fontFamily: "'Alegreya', serif",
  backgroundColor: '#f6f9fc',
  padding: '20px',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

const logo = {
  margin: '0 auto',
  display: 'block',
  textAlign: 'center' as const,
  padding: '20px 0',
};

const heading = {
  fontFamily: "'Belleza', sans-serif",
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: 'bold',
  color: '#1a1a1a',
  textAlign: 'center' as const,
  margin: '20px 0',
};

const paragraph = {
  fontFamily: "'Alegreya', serif",
  fontSize: '16px',
  lineHeight: '1.5',
  color: '#484848',
  margin: '16px 0',
  padding: '0 40px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
  padding: '0 40px',
};

const buttonStyle = {
  backgroundColor: '#d4a574',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block', // Changed from inline-block for better email client support
  width: '100%',
  maxWidth: '280px',
  margin: '0 auto',
  padding: '14px 28px',
  fontFamily: "'Alegreya', serif",
};

const warning = {
  fontFamily: "'Alegreya', serif",
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#666666',
  margin: '16px 0',
  padding: '0 40px',
  fontStyle: 'italic',
};

const footer = {
  fontFamily: "'Alegreya', serif",
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#999999',
  textAlign: 'center' as const,
  marginTop: '32px',
  padding: '0 40px',
};

export default function PasswordResetEmailTemplate({ resetLink }: PasswordResetEmailProps) {
  return (
    <div style={main}>
      <div style={container}>
        <div style={logo}>
          <h1 style={{ fontFamily: "'Belleza', sans-serif", fontSize: '28px', color: '#d4a574', margin: 0 }}>
            Looks by Anum
          </h1>
        </div>

        <h2 style={heading}>Password Reset Request</h2>

        <p style={paragraph}>
          We received a request to reset your password for your admin account. Click the button below to reset your password:
        </p>

        <div style={buttonContainer}>
          <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
            <tr>
              <td style={{ textAlign: 'center' as const, padding: '0' }}>
                <a href={resetLink} style={buttonStyle}>
                  Reset Password
                </a>
              </td>
            </tr>
          </table>
        </div>

        <p style={warning}>
          If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>

        <p style={paragraph}>
          This link will expire in 1 hour for security reasons.
        </p>

        <p style={footer}>
          If the button doesn't work, copy and paste this link into your browser:<br />
          <span style={{ wordBreak: 'break-all', color: '#d4a574' }}>{resetLink}</span>
        </p>

        <p style={footer}>
          © {new Date().getFullYear()} Looks by Anum. All rights reserved.
        </p>
      </div>
    </div>
  );
}












