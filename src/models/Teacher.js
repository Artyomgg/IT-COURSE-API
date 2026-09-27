// server/src/models/Teacher.js
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const teacherSchema = new mongoose.Schema({
	full_name: { type: String, required: true, trim: true },
	username: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
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

teacherSchema.pre('save', async function () {
	if (!this.isModified('password')) return
	const salt = await bcrypt.genSalt(10)
	this.password = await bcrypt.hash(this.password, salt)
})

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
