const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const teacherSchema = new mongoose.Schema({
	full_name: { type: String, required: true },
	username: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true, lowercase: true },
	phone: { type: String, default: '' },
	password: { type: String, required: true },
	school: { type: String, required: true },
	subject: { type: String, required: true },
	role: { type: String, enum: ['teacher', 'super_admin'], default: 'teacher' },
	is_active: { type: Boolean, default: true },
	created_at: { type: Date, default: Date.now },
})

// Метод сравнения паролей
teacherSchema.methods.comparePassword = async function (candidatePassword) {
	return await bcrypt.compare(candidatePassword, this.password)
}

const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema)

module.exports = Teacher
