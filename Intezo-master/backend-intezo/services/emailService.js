import nodemailer from 'nodemailer';
import crypto from 'crypto';

class EmailService {
  constructor() {
    // Try multiple email configurations
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    // Gmail configuration with better deliverability settings
    if (process.env.EMAIL_SERVICE === 'gmail') {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        pool: true,
        maxConnections: 1,
        rateDelta: 20000,
        rateLimit: 5
      });
    }
    
    // Generic SMTP configuration
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
      },
      pool: true,
      maxConnections: 1,
      rateDelta: 20000,
      rateLimit: 5
    });
  }

  generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  async sendVerificationEmail(email, code, userType) {
    // Skip email sending if credentials not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Email service is not configured');
      }
      console.log(`Email not configured. Verification code for ${email}: ${code}`);
      return true; // Return true for development
    }

    const mailOptions = {
      from: `"Intezo Medical Center" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🏥 Your Intezo Medical Verification Code`,
      replyTo: process.env.EMAIL_USER,
      text: `Your verification code is: ${code}. This code expires in 10 minutes.`,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'X-Mailer': 'Intezo Medical System',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`
      },
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🏥 Intezo Medical</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Trusted Healthcare Management</p>
          </div>
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 30px; text-align: center;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Email Verification Required</h2>
            <p style="color: #4b5563; margin: 0 0 25px 0; font-size: 16px;">Please use the verification code below to complete your ${userType.toLowerCase()} account setup:</p>
            
            <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 25px 0;">
              ${code}
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">⏰ This code will expire in 10 minutes for security purposes.</p>
            <p style="color: #059669; font-size: 12px; margin: 10px 0 0 0;">✅ This is an automated security message from Intezo Medical Center</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">🔒 If you didn't request this verification, please ignore this email.</p>
            <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">📧 Contact us: ${process.env.EMAIL_USER}</p>
            <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">© 2024 Intezo Medical Center. All rights reserved.</p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error.message);
      if (process.env.NODE_ENV === 'production') throw error;
      console.log(`Development mode - Verification code for ${email}: ${code}`);
      return true; // Return true in development to allow testing
    }
  }

  async sendApprovalEmail(email, userType, approved) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`Email not configured. ${approved ? 'Approved' : 'Rejected'} notification for ${email}`);
      return true;
    }

    const status = approved ? 'Approved' : 'Rejected';
    const color = approved ? '#059669' : '#dc2626';
    const icon = approved ? '✅' : '❌';
    
    const mailOptions = {
      from: `"Intezo Medical Center" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${icon} Your ${userType} Registration ${status}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; background: ${color}; color: white; padding: 20px; border-radius: 8px;">
            <h1>${icon} Registration ${status}</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9; margin-top: 20px; border-radius: 8px;">
            <p>Dear ${userType},</p>
            <p>Your registration has been <strong>${status.toLowerCase()}</strong>.</p>
            ${approved ? 
              '<p>You can now log in to your account and start using our services.</p>' : 
              '<p>If you have any questions, please contact our support team.</p>'
            }
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`${status} email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Approval email failed:', error.message);
      return true;
    }
  }

  async sendReportNotification(email, patientName, clinicName, doctorName, reportTitle) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`Email not configured. Report notification for ${email}`);
      return true;
    }

    const mailOptions = {
      from: `"Intezo Medical Center" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `📋 Your Medical Report is Ready - ${reportTitle}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🏥 Intezo Medical</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Healthcare Partner</p>
          </div>
          
          <div style="background-color: #f0f9ff; border-radius: 8px; padding: 30px; text-align: center; border-left: 4px solid #0ea5e9;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">📋 Medical Report Ready!</h2>
            <p style="color: #4b5563; margin: 0 0 25px 0; font-size: 16px;">Dear ${patientName},</p>
            <p style="color: #4b5563; margin: 0 0 25px 0; font-size: 16px;">Your medical report is now available for download.</p>
            
            <div style="background-color: #ffffff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: left;">
              <p style="margin: 0 0 10px 0; color: #374151;"><strong>Report Title:</strong> ${reportTitle}</p>
              <p style="margin: 0 0 10px 0; color: #374151;"><strong>Doctor:</strong> Dr. ${doctorName}</p>
              <p style="margin: 0 0 10px 0; color: #374151;"><strong>Clinic:</strong> ${clinicName}</p>
              <p style="margin: 0; color: #374151;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p style="color: #059669; font-size: 14px; margin: 20px 0 0 0;">📱 Open the Intezo app to view and download your report</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">🔒 This is a secure medical communication from Intezo Medical Center</p>
            <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">📧 Contact us: ${process.env.EMAIL_USER}</p>
            <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">© 2024 Intezo Medical Center. All rights reserved.</p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Report notification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Report notification email failed:', error.message);
      return true;
    }
  }
}

export default new EmailService();
