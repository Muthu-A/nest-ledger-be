const inviteTemplate = ({ inviterName, inviteCode, inviteLink }) => `
<div style="
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  max-width: 600px;
  margin: auto;
  background: #ffffff;
">

  <!-- Header -->
  <div style="
    background: linear-gradient(135deg, #16A34A 0%, #15803D 100%);
    padding: 40px 30px;
    text-align: center;
    border-radius: 16px 16px 0 0;
  ">
    <div style="
      width: 56px;
      height: 56px;
      background: rgba(255,255,255,0.15);
      border-radius: 14px;
      display: inline-block;
      line-height: 56px;
      font-size: 28px;
      margin-bottom: 16px;
    ">💌</div>
    <h1 style="
      color: #ffffff;
      font-size: 24px;
      margin: 0;
      font-weight: 700;
    ">You've been invited!</h1>
  </div>

  <!-- Body -->
  <div style="
    padding: 36px 30px;
    border: 1px solid #E5E7EB;
    border-top: none;
    border-radius: 0 0 16px 16px;
  ">
    <p style="
      font-size: 16px;
      color: #374151;
      line-height: 1.6;
      margin: 0 0 24px;
    ">
      <strong>${inviterName}</strong> invited you to join their
      <strong style="color:#16A34A;">NestLedger Family</strong> — manage money together, all in one place.
    </p>

    <!-- Feature grid -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
      <tr>
        <td width="50%" style="padding: 8px 8px 8px 0;">
          <div style="background:#F9FAFB; border-radius:10px; padding:14px 16px; font-size:14px; color:#374151;">
            💰 <strong>Income</strong> tracking
          </div>
        </td>
        <td width="50%" style="padding: 8px 0 8px 8px;">
          <div style="background:#F9FAFB; border-radius:10px; padding:14px 16px; font-size:14px; color:#374151;">
            💳 <strong>Expenses</strong> tracking
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding: 8px 8px 8px 0;">
          <div style="background:#F9FAFB; border-radius:10px; padding:14px 16px; font-size:14px; color:#374151;">
            📊 <strong>Budgets</strong>
          </div>
        </td>
        <td width="50%" style="padding: 8px 0 8px 8px;">
          <div style="background:#F9FAFB; border-radius:10px; padding:14px 16px; font-size:14px; color:#374151;">
            🎯 <strong>Goals</strong>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding: 8px 8px 8px 0;">
          <div style="background:#F9FAFB; border-radius:10px; padding:14px 16px; font-size:14px; color:#374151;">
            📈 <strong>Investments</strong>
          </div>
        </td>
        <td width="50%" style="padding: 8px 0 8px 8px;">
          <div style="background:#F9FAFB; border-radius:10px; padding:14px 16px; font-size:14px; color:#374151;">
            🤖 <strong>AI Insights</strong>
          </div>
        </td>
      </tr>
    </table>

    <!-- Invite code -->
    <div style="
      background: #F0FDF4;
      border: 1px dashed #16A34A;
      padding: 20px;
      border-radius: 12px;
      margin: 0 0 28px;
      text-align: center;
    ">
      <p style="
        margin: 0 0 8px;
        font-size: 12px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #6B7280;
        font-weight: 600;
      ">Your invite code</p>
      <h2 style="
        margin: 0;
        font-size: 28px;
        letter-spacing: 2px;
        color: #16A34A;
        font-weight: 800;
      ">${inviteCode}</h2>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${inviteLink}" style="
        display: inline-block;
        background: #16A34A;
        color: #ffffff;
        padding: 15px 36px;
        border-radius: 10px;
        text-decoration: none;
        font-weight: 700;
        font-size: 15px;
        box-shadow: 0 4px 12px rgba(22,163,74,0.25);
      ">Join Family →</a>
    </div>

    <p style="
      font-size: 13px;
      color: #6B7280;
      text-align: center;
      line-height: 1.6;
      margin: 0 0 20px;
      word-break: break-all;
    ">
      Or use this link:<br>
      <a href="${inviteLink}" style="color:#16A34A; text-decoration:underline;">${inviteLink}</a>
    </p>

    <div style="
      border-top: 1px solid #E5E7EB;
      padding-top: 16px;
      text-align: center;
    ">
      <p style="
        font-size: 12px;
        color: #9CA3AF;
        margin: 0;
      ">⏳ This invitation expires in 7 days.</p>
    </div>
  </div>
</div>
`;

module.exports = inviteTemplate;