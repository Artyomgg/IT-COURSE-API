// server/src/models/Teacher.js
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const teacherSchema = new mongoose.Schema({
	full_name: { type: String, required: true },
	username: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true, lowercase: true },
	phone: { type: String, default: '' },
	password: { type: String, required: true },
	school: { type: String, required: true },
	school_id: {
		type: String,
		required: true,
		default: function () {
			return this.school.toLowerCase().replace(/[^a-z0-9]/g, '_')
		},
	},
	subject: { type: String, default: 'Информатика' },
	role: {
		type: String,
		enum: ['teacher', 'school_admin', 'super_admin'],
		default: 'teacher',
	},
	avatar: { type: String, default: '' },
	is_active: { type: Boolean, default: true },
	created_at: { type: Date, default: Date.now },
	last_login: { type: Date },
	login_count: { type: Number, default: 0 },
})

// Исправленный pre-save хук — БЕЗ next()
teacherSchema.pre('save', async function () {
	// Если пароль не изменился — пропускаем
	if (!this.isModified('password')) return

	// Хэшируем пароль
	const salt = await bcrypt.genSalt(10)
	this.password = await bcrypt.hash(this.password, salt)
})

// Метод сравнения паролей
teacherSchema.methods.comparePassword = async function (candidatePassword) {
	try {
		return await bcrypt.compare(candidatePassword, this.password)
	} catch (error) {
		console.error('Ошибка сравнения пароля:', error)
		return false
	}
}

const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema)

module.exports = Teacher
