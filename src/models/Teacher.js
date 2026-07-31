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
	role: { type: String, enum: ['teacher', 'super_admin'], default: 'teacher' },
	is_active: { type: Boolean, default: true },
	created_at: { type: Date, default: Date.now },
	last_login: { type: Date },
	login_count: { type: Number, default: 0 },
})

teacherSchema.methods.comparePassword = async function (candidatePassword) {
	return await bcrypt.compare(candidatePassword, this.password)
}

const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema)

module.exports = Teacher
