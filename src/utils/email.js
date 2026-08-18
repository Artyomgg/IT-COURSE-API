// server/src/utils/email.js
const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST || 'smtp.gmail.com',
	port: parseInt(process.env.SMTP_PORT) || 587,
	secure: false,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
})

const sendSchoolApprovalEmail = async ({
	to,
	schoolName,
	adminName,
	adminEmail,
	adminPassword,
	loginLink,
}) => {
	const html = `
	<!DOCTYPE html>
	<html>
	<head>
		<style>
			body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
			.container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px; }
			.header { background: linear-gradient(135deg, #4facfe, #667eea); padding: 20px; border-radius: 10px 10px 0 0; color: white; text-align: center; }
			.content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
			.highlight { background: #f0f4ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4facfe; }
			.password-box { background: #2d3748; color: #f7fafc; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center; margin: 15px 0; }
			.btn { display: inline-block; padding: 12px 30px; background: #4facfe; color: white; text-decoration: none; border-radius: 8px; margin-top: 15px; }
			.footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
			ul { padding-left: 20px; }
			li { margin: 8px 0; }
		</style>
	</head>
	<body>
		<div class="container">
			<div class="header">
				<h1>🎉 ${schoolName} зарегистрирована!</h1>
				<p>Добро пожаловать в IT-COURSE</p>
			</div>
			<div class="content">
				<h2>Здравствуйте, ${adminName}!</h2>
				<p>Ваша заявка на регистрацию школы <strong>${schoolName}</strong> одобрена!</p>
				<p>Теперь вы можете управлять своей школой на платформе IT-COURSE.</p>

				<div class="highlight">
					<h3>📋 Ваши данные для входа:</h3>
					<p><strong>Email:</strong> ${adminEmail}</p>
					<div class="password-box">${adminPassword}</div>
					<p style="font-size: 12px; color: #999;">⚠️ Сохраните этот пароль. Он показан только один раз.</p>
				</div>

				<p>Войдите в систему:</p>
				<a href="${loginLink}" class="btn">🔑 Войти в IT-COURSE</a>

				<h3>📌 Что вы можете делать:</h3>
				<ul>
					<li>✅ Создавать учителей в своей школе</li>
					<li>✅ Просматривать результаты тестов учеников</li>
				</ul>

				<p style="margin-top: 20px; color: #666;">
					Если у вас есть вопросы: <a href="mailto:${process.env.SUPPORT_EMAIL || 'itcourse.edu@gmail.com'}">${process.env.SUPPORT_EMAIL || 'itcourse.edu@gmail.com'}</a>
				</p>

				<div class="footer">
					<p>© 2026 IT-COURSE • Образовательная платформа</p>
					<p>Это автоматическое письмо, не отвечайте на него.</p>
				</div>
			</div>
		</div>
	</body>
	</html>
	`

	await transporter.sendMail({
		from: process.env.SMTP_FROM || '"IT-COURSE" <itcourse.edu@gmail.com>',
		to: to,
		subject: `🎉 ${schoolName} зарегистрирована на IT-COURSE!`,
		html: html,
	})
}

const sendSchoolRejectionEmail = async ({ to, schoolName, reason }) => {
	const html = `
	<!DOCTYPE html>
	<html>
	<head>
		<style>
			body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
			.container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px; }
			.header { background: #ff6b6b; padding: 20px; border-radius: 10px 10px 0 0; color: white; text-align: center; }
			.content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
			.footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
		</style>
	</head>
	<body>
		<div class="container">
			<div class="header">
				<h1>❌ Заявка на регистрацию отклонена</h1>
			</div>
			<div class="content">
				<h2>Здравствуйте!</h2>
				<p>К сожалению, ваша заявка на регистрацию школы <strong>${schoolName}</strong> была отклонена.</p>
				${reason ? `<p><strong>Причина:</strong> ${reason}</p>` : ''}
				<p>Если вы считаете, что это ошибка, свяжитесь с нами:</p>
				<p><a href="mailto:${process.env.SUPPORT_EMAIL || 'itcourse.edu@gmail.com'}">${process.env.SUPPORT_EMAIL || 'itcourse.edu@gmail.com'}</a></p>
				<div class="footer">
					<p>© 2026 IT-COURSE • Образовательная платформа</p>
				</div>
			</div>
		</div>
	</body>
	</html>
	`

	await transporter.sendMail({
		from: process.env.SMTP_FROM || '"IT-COURSE" <itcourse.edu@gmail.com>',
		to: to,
		subject: `❌ Заявка на регистрацию ${schoolName} отклонена`,
		html: html,
	})
}

const testEmailConnection = async () => {
	try {
		await transporter.verify()
		console.log('✅ Email (Gmail) настроен успешно!')
		return true
	} catch (error) {
		console.error('❌ Ошибка настройки email:', error.message)
		return false
	}
}

module.exports = {
	sendSchoolApprovalEmail,
	sendSchoolRejectionEmail,
	testEmailConnection,
}
