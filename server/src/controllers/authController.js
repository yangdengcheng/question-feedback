const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user.toJSON();
  return rest;
}

async function register(req, res, next) {
  try {
    const { username, password, realName, email } = req.body;
    if (!username || !password || !realName) {
      return res.status(400).json({ message: "用户名、密码和姓名为必填项" });
    }
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "用户名已存在" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash, realName, email: email || null });
    const token = generateToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "用户名和密码为必填项" });
    }
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "账号已被禁用" });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }
    const token = generateToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    res.json(sanitizeUser(req.user));
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, me };
