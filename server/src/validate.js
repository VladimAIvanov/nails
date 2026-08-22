/* Проверка входных данных. Вызывается до обращения к базе: неверный запрос
   не должен доходить до SQL и получать в ответ текст ошибки движка. */
import { badRequest } from './http.js';

const PHONE = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SLUG = /^[a-z0-9-]{2,40}$/;

export function required(value, field) {
  if (value === undefined || value === null || value === '') {
    throw badRequest(`Не заполнено поле «${field}»`);
  }
  return value;
}

export function str(value, field, { min = 1, max = 200 } = {}) {
  required(value, field);
  if (typeof value !== 'string') throw badRequest(`Поле «${field}» должно быть строкой`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw badRequest(`Поле «${field}»: минимум ${min} символов`);
  if (trimmed.length > max) throw badRequest(`Поле «${field}»: максимум ${max} символов`);
  return trimmed;
}

export function optionalStr(value, field, opts) {
  if (value === undefined || value === null || value === '') return null;
  return str(value, field, opts);
}

export function int(value, field, { min = -Infinity, max = Infinity } = {}) {
  required(value, field);
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) throw badRequest(`Поле «${field}» должно быть целым числом`);
  if (n < min || n > max) throw badRequest(`Поле «${field}»: допустимо от ${min} до ${max}`);
  return n;
}

export function bool(value, field) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === 0 || value === 1) return value;
  throw badRequest(`Поле «${field}» должно быть true или false`);
}

export function phone(value, field = 'phone') {
  const v = str(value, field, { max: 20 }).replace(/[\s()-]/g, '');
  if (!PHONE.test(v)) {
    throw badRequest(`Поле «${field}»: телефон в формате +79210000000`);
  }
  return v;
}

export function email(value, field = 'email') {
  const v = str(value, field, { max: 200 }).toLowerCase();
  if (!EMAIL.test(v)) throw badRequest(`Поле «${field}»: некорректный адрес почты`);
  return v;
}

export function password(value, field = 'password') {
  const v = str(value, field, { min: 8, max: 200 });
  return v;
}

export function date(value, field = 'date') {
  const v = str(value, field, { max: 10 });
  if (!DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    throw badRequest(`Поле «${field}»: дата в формате ГГГГ-ММ-ДД`);
  }
  return v;
}

/* Время принимается только в UTC с суффиксом Z — тем же форматом, в котором
   хранится. Значение с иным смещением отвергается: додумывать пояс за клиента
   нельзя, из этого выходят записи, уехавшие на три часа. */
export function isoUtc(value, field = 'starts_at') {
  const v = str(value, field, { max: 30 });
  if (!ISO.test(v) || Number.isNaN(Date.parse(v))) {
    throw badRequest(`Поле «${field}»: момент в формате 2026-08-24T10:00:00Z (UTC)`);
  }
  return v;
}

export function slug(value, field = 'slug') {
  const v = str(value, field, { max: 40 }).toLowerCase();
  if (!SLUG.test(v)) throw badRequest(`Поле «${field}»: латиница, цифры и дефис`);
  return v;
}

export function oneOf(value, field, allowed) {
  const v = str(value, field, { max: 40 });
  if (!allowed.includes(v)) {
    throw badRequest(`Поле «${field}»: допустимо ${allowed.join(', ')}`);
  }
  return v;
}

export function idParam(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw badRequest(`Некорректный ${field}`);
  return n;
}

export function idList(value, field, { min = 1, max = 10 } = {}) {
  if (!Array.isArray(value) || value.length < min) {
    throw badRequest(`Поле «${field}»: ожидается список идентификаторов`);
  }
  if (value.length > max) throw badRequest(`Поле «${field}»: не больше ${max} значений`);
  return value.map((v) => idParam(v, field));
}
