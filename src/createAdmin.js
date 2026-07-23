// server/src/createAdmin.js
require('dotenv').config()
const mongoose = require('mongoose')
const Teacher = require('./models/Teacher')

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
	console.error('❌ MONGODB_URI не найден в .env файле')
	process.exit(1)
}

mongoose
	.connect(MONGODB_URI)
	.then(async () => {
		console.log('✅ Подключено к MongoDB Atlas')

		try {
			// Проверяем, существует ли уже администратор
			const existingAdmin = await Teacher.findOne({ email: 'admin@school.com' })

			if (existingAdmin) {
				console.log('⚠️ Администратор уже существует. Обновляем пароль...')
				existingAdmin.password = 'admin2025'
				await existingAdmin.save()
				console.log('✅ Пароль администратора обновлен!')
			} else {
				// Создаем нового администратора
				const admin = new Teacher({
					full_name: 'Дудко Артем Дмитриевич',
					username: 'itcourse',
					email: 'admin@school.com',
					phone: '',
					password: 'admin2025',
					school: 'Школа №30 г. Минска',
					subject: 'Администрирование',
					role: 'super_admin',
					is_active: true,
				})

				await admin.save()
				console.log('✅ Администратор создан!')
			}

			console.log('📧 Email: admin@school.com')
			console.log('🔑 Пароль: admin2025')
		} catch (error) {
			console.error('❌ Ошибка при создании администратора:', error)
		} finally {
			await mongoose.connection.close()
			process.exit(0)
		}
	})
	.catch(err => {
		console.error('❌ Ошибка подключения к MongoDB:', err)
		process.exit(1)
	})
