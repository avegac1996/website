const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT || '587') === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

async function sendEmail(to, subject, html) {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"TURINGTECH" <${process.env.SMTP_USER || 'noreply@turingtech.com.ec'}>`,
      to,
      subject,
      html,
    });
    console.log(`Email enviado a ${to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('Error enviando email:', err.message);
    return false;
  }
}

async function sendVerificationEmail(email, token) {
  const url = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html?token=${token}`;
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #050C1F; padding: 40px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #FF6B00; font-size: 28px; margin: 0;">TURINGTECH</h1>
        <p style="color: #64748B; font-size: 14px;">Ecuador</p>
      </div>
      <h2 style="color: #F1F5F9; font-size: 22px;">Verifica tu cuenta</h2>
      <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
        Bienvenido a TURINGTECH. Para activar tu cuenta y recibir tus créditos iniciales, confirma tu email haciendo clic en el siguiente botón:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${url}" style="background: linear-gradient(135deg, #FF6B00, #E05E00); color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Verificar mi email
        </a>
      </div>
      <p style="color: #64748B; font-size: 14px;">
        Si no creaste una cuenta, puedes ignorar este correo.
      </p>
      <hr style="border: none; border-top: 1px solid #1E293B; margin: 32px 0;">
      <p style="color: #475569; font-size: 12px; text-align: center;">
        © 2026 TURINGTECH Ecuador. Todos los derechos reservados.
      </p>
    </div>
  `;
  return sendEmail(email, 'Verifica tu cuenta - TURINGTECH Ecuador', html);
}

async function sendWelcomeEmail(email, name, credits) {
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #050C1F; padding: 40px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #FF6B00; font-size: 28px; margin: 0;">TURINGTECH</h1>
        <p style="color: #64748B; font-size: 14px;">Ecuador</p>
      </div>
      <h2 style="color: #F1F5F9; font-size: 22px;">¡Cuenta verificada! 🎉</h2>
      <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
        Hola <strong style="color: #F1F5F9;">${name}</strong>, tu cuenta ha sido verificada correctamente.
      </p>
      <div style="background: rgba(255, 107, 0, 0.1); border: 1px solid rgba(255, 107, 0, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #94A3B8; font-size: 14px; margin: 0 0 8px 0;">Créditos asignados</p>
        <p style="color: #FF6B00; font-size: 36px; font-weight: 800; margin: 0;">${credits} créditos</p>
      </div>
      <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
        Ya puedes iniciar sesión y usar tus créditos en tu próximo proyecto con TURINGTECH.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/login.html" style="background: linear-gradient(135deg, #FF6B00, #E05E00); color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Iniciar sesión
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #1E293B; margin: 32px 0;">
      <p style="color: #475569; font-size: 12px; text-align: center;">
        © 2026 TURINGTECH Ecuador. Todos los derechos reservados.
      </p>
    </div>
  `;
  return sendEmail(email, '¡Bienvenido a TURINGTECH! Créditos asignados', html);
}

async function sendCreditRequestAdminEmail(adminEmail, userName, userEmail, projectDescription, requestedCredits) {
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #050C1F; padding: 40px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #FF6B00; font-size: 28px; margin: 0;">TURINGTECH</h1>
        <p style="color: #64748B; font-size: 14px;">Nueva solicitud de créditos</p>
      </div>
      <h2 style="color: #F1F5F9; font-size: 22px;">Nueva solicitud de créditos</h2>
      <div style="background: #111E3D; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p style="color: #94A3B8; font-size: 14px; margin: 0 0 4px 0;">Usuario</p>
        <p style="color: #F1F5F9; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">${userName}</p>
        <p style="color: #94A3B8; font-size: 14px; margin: 0 0 4px 0;">Email</p>
        <p style="color: #F1F5F9; font-size: 16px; margin: 0 0 16px 0;">${userEmail}</p>
        <p style="color: #94A3B8; font-size: 14px; margin: 0 0 4px 0;">Créditos solicitados</p>
        <p style="color: #FF6B00; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">${requestedCredits}</p>
        <p style="color: #94A3B8; font-size: 14px; margin: 0 0 4px 0;">Descripción del proyecto</p>
        <p style="color: #F1F5F9; font-size: 15px; line-height: 1.6; margin: 0;">${projectDescription}</p>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin.html" style="background: linear-gradient(135deg, #FF6B00, #E05E00); color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Revisar solicitud en panel admin
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #1E293B; margin: 32px 0;">
      <p style="color: #475569; font-size: 12px; text-align: center;">
        © 2026 TURINGTECH Ecuador. Todos los derechos reservados.
      </p>
    </div>
  `;
  return sendEmail(adminEmail, `Nueva solicitud de créditos - ${userName}`, html);
}

async function sendApprovedEmail(email, name, credits) {
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #050C1F; padding: 40px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #FF6B00; font-size: 28px; margin: 0;">TURINGTECH</h1>
      </div>
      <h2 style="color: #10B981; font-size: 22px;">✅ Solicitud aprobada</h2>
      <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
        Hola <strong style="color: #F1F5F9;">${name}</strong>, tu solicitud de créditos ha sido aprobada.
      </p>
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #94A3B8; font-size: 14px; margin: 0 0 8px 0;">Créditos asignados</p>
        <p style="color: #10B981; font-size: 36px; font-weight: 800; margin: 0;">+${credits} créditos</p>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html" style="background: linear-gradient(135deg, #FF6B00, #E05E00); color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Ver mi dashboard
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #1E293B; margin: 32px 0;">
      <p style="color: #475569; font-size: 12px; text-align: center;">
        © 2026 TURINGTECH Ecuador. Todos los derechos reservados.
      </p>
    </div>
  `;
  return sendEmail(email, 'Solicitud aprobada - TURINGTECH', html);
}

async function sendRejectedEmail(email, name, notes) {
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #050C1F; padding: 40px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #FF6B00; font-size: 28px; margin: 0;">TURINGTECH</h1>
      </div>
      <h2 style="color: #EF4444; font-size: 22px;">Solicitud no aprobada</h2>
      <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
        Hola <strong style="color: #F1F5F9;">${name}</strong>, tu solicitud de créditos no fue aprobada en esta ocasión.
      </p>
      ${notes ? `<div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 20px; margin: 24px 0;"><p style="color: #94A3B8; font-size: 14px; margin: 0 0 8px 0;">Notas del equipo</p><p style="color: #F1F5F9; font-size: 15px; margin: 0;">${notes}</p></div>` : ''}
      <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
        Si tienes preguntas, contáctanos en info@turingtech.com.ec
      </p>
      <hr style="border: none; border-top: 1px solid #1E293B; margin: 32px 0;">
      <p style="color: #475569; font-size: 12px; text-align: center;">
        © 2026 TURINGTECH Ecuador. Todos los derechos reservados.
      </p>
    </div>
  `;
  return sendEmail(email, 'Actualización de solicitud - TURINGTECH', html);
}

async function sendCreditModifiedEmail(email, name, amount, newBalance, reason) {
  const sign = amount >= 0 ? '+' : '';
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #050C1F; padding: 40px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #FF6B00; font-size: 28px; margin: 0;">TURINGTECH</h1>
      </div>
      <h2 style="color: #F1F5F9; font-size: 22px;">Actualización de créditos</h2>
      <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
        Hola <strong style="color: #F1F5F9;">${name}</strong>, tus créditos han sido actualizados.
      </p>
      <div style="background: #111E3D; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #94A3B8; font-size: 14px; margin: 0 0 8px 0;">Cambio</p>
        <p style="color: ${amount >= 0 ? '#10B981' : '#EF4444'}; font-size: 28px; font-weight: 700; margin: 0 0 16px 0;">${sign}${amount} créditos</p>
        <p style="color: #94A3B8; font-size: 14px; margin: 0 0 8px 0;">Balance actual</p>
        <p style="color: #FF6B00; font-size: 32px; font-weight: 800; margin: 0;">${newBalance} créditos</p>
      </div>
      ${reason ? `<p style="color: #94A3B8; font-size: 14px;">Motivo: ${reason}</p>` : ''}
      <hr style="border: none; border-top: 1px solid #1E293B; margin: 32px 0;">
      <p style="color: #475569; font-size: 12px; text-align: center;">
        © 2026 TURINGTECH Ecuador. Todos los derechos reservados.
      </p>
    </div>
  `;
  return sendEmail(email, 'Tus créditos han sido actualizados - TURINGTECH', html);
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendCreditRequestAdminEmail,
  sendApprovedEmail,
  sendRejectedEmail,
  sendCreditModifiedEmail,
};
