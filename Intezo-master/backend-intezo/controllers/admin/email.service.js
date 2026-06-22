export const sendPremiumStatusEmail = async (patient, status, reason = '') => {
  const isApproved = status === 'approved';
  const mailOptions = {
    to: patient.email,
    subject: isApproved ? '✅ Premium Subscription Approved' : '❌ Premium Payment Rejected',
    html: isApproved ? renderApprovalTemplate(patient.name) : renderRejectionTemplate(patient.name, reason)
  };
  return transporter.sendMail(mailOptions);
};