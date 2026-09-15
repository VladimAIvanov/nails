/* @ds-bundle: {"format":4,"namespace":"DesignSystem_f8f42b","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"Chip","sourcePath":"components/actions/Chip.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"BookingCard","sourcePath":"components/booking/BookingCard.jsx"},{"name":"DateStrip","sourcePath":"components/booking/DateStrip.jsx"},{"name":"MasterCard","sourcePath":"components/booking/MasterCard.jsx"},{"name":"ServiceCard","sourcePath":"components/booking/ServiceCard.jsx"},{"name":"SlotPicker","sourcePath":"components/booking/SlotPicker.jsx"},{"name":"Notice","sourcePath":"components/feedback/Notice.jsx"},{"name":"Rating","sourcePath":"components/feedback/Rating.jsx"},{"name":"StatusBadge","sourcePath":"components/feedback/StatusBadge.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"TextArea","sourcePath":"components/forms/TextArea.jsx"},{"name":"BottomSheet","sourcePath":"components/layout/BottomSheet.jsx"},{"name":"Card","sourcePath":"components/layout/Card.jsx"},{"name":"SectionHeader","sourcePath":"components/layout/SectionHeader.jsx"},{"name":"Avatar","sourcePath":"components/media/Avatar.jsx"},{"name":"Icon","sourcePath":"components/media/Icon.jsx"},{"name":"ImageFrame","sourcePath":"components/media/ImageFrame.jsx"},{"name":"BottomNav","sourcePath":"components/navigation/BottomNav.jsx"},{"name":"Stepper","sourcePath":"components/navigation/Stepper.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"857a63572e87","components/actions/Chip.jsx":"0c87d3dd9512","components/actions/IconButton.jsx":"a852825a82f8","components/booking/BookingCard.jsx":"72c58d0d21dc","components/booking/DateStrip.jsx":"6caf067b526d","components/booking/MasterCard.jsx":"6c979a094727","components/booking/ServiceCard.jsx":"3f213ce46bbd","components/booking/SlotPicker.jsx":"9e72dac953fc","components/feedback/Notice.jsx":"4dfa8542ce73","components/feedback/Rating.jsx":"a76c99f3a725","components/feedback/StatusBadge.jsx":"46fc32370a22","components/forms/Checkbox.jsx":"9528733f0c65","components/forms/Input.jsx":"f2d8ed986bb9","components/forms/Select.jsx":"7d3c19ed8e05","components/forms/Switch.jsx":"bb99793333de","components/forms/TextArea.jsx":"a1fe292994d4","components/layout/BottomSheet.jsx":"0636ae9af8b0","components/layout/Card.jsx":"f2bee9a867e5","components/layout/SectionHeader.jsx":"4559fd1183b1","components/media/Avatar.jsx":"969440e13d5a","components/media/Icon.jsx":"e2572746fb76","components/media/ImageFrame.jsx":"a65923cf2af9","components/navigation/BottomNav.jsx":"6015a8e40c3f","components/navigation/Stepper.jsx":"0bac974ce158","components/navigation/TopBar.jsx":"9e90d324757d","ui_kits/admin/admin-data.js":"6c74b9b2c16a","ui_kits/admin/admin.jsx":"f3ee438548fa","ui_kits/telegram_mini_app/account.jsx":"293a443c9894","ui_kits/telegram_mini_app/app.jsx":"474520d6cc06","ui_kits/telegram_mini_app/booking-flow.jsx":"ab1210d9ebc9","ui_kits/telegram_mini_app/data.js":"7c9c9759e666","ui_kits/website/booking-modal.jsx":"a1c1ba9214d2","ui_kits/website/site.jsx":"0fabda7dc814"},"inlinedExternals":[],"unexposedExports":[{"name":"statusLabels","sourcePath":"components/feedback/StatusBadge.jsx"}]} */

(() => {

const __ds_ns = (window.DesignSystem_f8f42b = window.DesignSystem_f8f42b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Основная кнопка. primary — одно главное действие на экран («Записаться»). */
function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  iconLeft,
  iconRight,
  disabled = false,
  as = 'button',
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const Tag = as;
  const cls = ['v-btn', `v-btn--${variant}`, size !== 'md' && `v-btn--${size}`, block && 'v-btn--block', className].filter(Boolean).join(' ');
  const native = Tag === 'button';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls,
    type: native ? type : undefined,
    disabled: native ? disabled : undefined,
    "aria-disabled": !native && disabled ? true : undefined
  }, rest), iconLeft, children ? /*#__PURE__*/React.createElement("span", {
    className: "v-btn__label"
  }, children) : null, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/booking/DateStrip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Горизонтальная лента дат — верхний уровень выбора времени. Ниже ставится SlotPicker. */
function DateStrip({
  days = [],
  value,
  onChange,
  showFree = true,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['v-date-strip', className].filter(Boolean).join(' ')
  }, rest), days.map(d => {
    const selected = d.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: d.id,
      type: "button",
      className: ['v-date-day', selected && 'v-date-day--selected'].filter(Boolean).join(' '),
      disabled: d.disabled,
      "aria-pressed": selected,
      onClick: () => onChange && onChange(d.id)
    }, /*#__PURE__*/React.createElement("span", {
      className: "v-date-day__dow"
    }, d.dow), /*#__PURE__*/React.createElement("span", {
      className: "v-date-day__num"
    }, d.day), showFree ? /*#__PURE__*/React.createElement("span", {
      className: "v-date-day__free"
    }, d.disabled ? '—' : `${d.free} окон`) : null);
  }));
}
Object.assign(__ds_scope, { DateStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/DateStrip.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Rating.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Рейтинг мастера: звёзды + число + количество отзывов. */
function Rating({
  value = 5,
  count,
  showStars = true,
  className = '',
  ...rest
}) {
  const rounded = Math.round(value);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['v-rating', className].filter(Boolean).join(' ')
  }, rest), showStars ? /*#__PURE__*/React.createElement("span", {
    className: "v-rating__stars",
    "aria-hidden": "true"
  }, [1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: ['v-rating__star', 'icon-star', i <= rounded && 'v-rating__star--on'].filter(Boolean).join(' ')
  }))) : null, /*#__PURE__*/React.createElement("span", {
    className: "v-rating__value"
  }, value.toFixed(1).replace('.', ',')), count != null ? /*#__PURE__*/React.createElement("span", {
    className: "v-rating__count"
  }, "(", count, ")") : null);
}
Object.assign(__ds_scope, { Rating });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Rating.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StatusBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STATUS_LABELS = {
  confirmed: 'Запись подтверждена',
  pending: 'Ожидает подтверждения',
  cancelled: 'Запись отменена',
  done: 'Завершена'
};
const STATUS_SHORT = {
  confirmed: 'Подтверждена',
  pending: 'Ожидает',
  cancelled: 'Отменена',
  done: 'Завершена'
};

/** Статус записи. Цвет + точка + слово — цветом одним статус не кодируем. */
function StatusBadge({
  status = 'pending',
  label,
  short = false,
  size = 'md',
  className = '',
  ...rest
}) {
  const cls = ['v-status', `v-status--${status}`, size === 'lg' && 'v-status--lg', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "v-status__dot"
  }), label || (short ? STATUS_SHORT[status] : STATUS_LABELS[status]));
}
const statusLabels = STATUS_LABELS;
Object.assign(__ds_scope, { StatusBadge, statusLabels });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Чекбокс: согласие на обработку данных, напоминание в Telegram. */
function Checkbox({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  className = '',
  ...rest
}) {
  const cls = ['v-checkbox', disabled && 'v-checkbox--disabled', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("label", {
    className: cls
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "v-checkbox__box"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-checkbox__tick icon-check"
  })), /*#__PURE__*/React.createElement("span", {
    className: "v-checkbox__text"
  }, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Выпадающий список: мастер, филиал, длительность. Для 2–4 вариантов лучше Chip. */
function Select({
  label,
  hint,
  error,
  required = false,
  options = [],
  placeholder,
  id,
  className = '',
  children,
  ...rest
}) {
  const inputId = id || `v-select-${Math.random().toString(36).slice(2, 7)}`;
  const cls = ['v-input', 'v-select', error && 'v-input--invalid', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: "v-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "v-field__label",
    htmlFor: inputId
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__req"
  }, " *") : null) : null, /*#__PURE__*/React.createElement("div", {
    className: "v-input-wrap"
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: inputId,
    className: cls
  }, rest), placeholder ? /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder) : null, options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label)), children), /*#__PURE__*/React.createElement("span", {
    className: "v-select-chevron icon-chevron-down"
  })), error ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__error"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Переключатель настройки: напоминания, приём онлайн-записи (админка). */
function Switch({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  className = '',
  ...rest
}) {
  const cls = ['v-switch', disabled && 'v-switch--disabled', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("label", {
    className: cls
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "v-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-switch__thumb"
  })), label ? /*#__PURE__*/React.createElement("span", {
    className: "v-switch__text"
  }, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextArea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Многострочное поле: комментарий к записи, пожелания к дизайну. */
function TextArea({
  label,
  hint,
  error,
  required = false,
  rows = 3,
  id,
  className = '',
  ...rest
}) {
  const inputId = id || `v-textarea-${Math.random().toString(36).slice(2, 7)}`;
  const cls = ['v-input', 'v-input--textarea', error && 'v-input--invalid', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: "v-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "v-field__label",
    htmlFor: inputId
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__req"
  }, " *") : null) : null, /*#__PURE__*/React.createElement("textarea", _extends({
    id: inputId,
    rows: rows,
    className: cls,
    "aria-invalid": error ? true : undefined
  }, rest)), error ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__error"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { TextArea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextArea.jsx", error: String((e && e.message) || e) }); }

// components/layout/BottomSheet.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Нижняя шторка — основной способ показать детали и подтверждение в мини-аппе.
 *  Рендерится внутри ближайшего родителя с position:relative (экран телефона). */
function BottomSheet({
  open = false,
  title,
  onClose,
  footer,
  className = '',
  children,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "v-sheet-scrim",
    onClick: onClose,
    role: "presentation"
  }, /*#__PURE__*/React.createElement("div", _extends({
    className: ['v-sheet', className].filter(Boolean).join(' '),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
    onClick: e => e.stopPropagation()
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "v-sheet__grabber"
  }), title ? /*#__PURE__*/React.createElement("div", {
    className: "v-sheet__title"
  }, title) : null, children, footer));
}
Object.assign(__ds_scope, { BottomSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/BottomSheet.jsx", error: String((e && e.message) || e) }); }

// components/layout/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Базовая карточка-поверхность. Всё, что «лежит» на кремовом фоне. */
function Card({
  variant = 'default',
  interactive = false,
  selected = false,
  as,
  className = '',
  children,
  ...rest
}) {
  const Tag = as || (interactive ? 'button' : 'div');
  const cls = ['v-card', variant !== 'default' && `v-card--${variant}`, interactive && 'v-card--interactive', selected && 'v-card--selected', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls,
    type: Tag === 'button' ? 'button' : undefined
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Card.jsx", error: String((e && e.message) || e) }); }

// components/layout/SectionHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Заголовок секции: надзаголовок капслоком + serif-заголовок + действие справа. */
function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['v-section-header', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", null, eyebrow ? /*#__PURE__*/React.createElement("div", {
    className: "v-section-header__eyebrow"
  }, eyebrow) : null, /*#__PURE__*/React.createElement("h2", {
    className: "v-section-header__title"
  }, title), subtitle ? /*#__PURE__*/React.createElement("p", {
    className: "v-section-header__sub"
  }, subtitle) : null), action ? /*#__PURE__*/React.createElement("div", {
    className: "v-section-header__action"
  }, action) : null);
}
Object.assign(__ds_scope, { SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/SectionHeader.jsx", error: String((e && e.message) || e) }); }

// components/media/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Аватар мастера или клиента. Без фото — инициал на нюдовом градиенте. */
function Avatar({
  src,
  name = '',
  size = 48,
  shape = 'circle',
  ring = false,
  className = '',
  style,
  ...rest
}) {
  const initial = name.trim().charAt(0).toUpperCase();
  const cls = ['v-avatar', shape === 'squircle' && 'v-avatar--squircle', ring && 'v-avatar--ring', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    style: {
      width: size,
      height: size,
      fontSize: Math.round(size * 0.42),
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name
  }) : /*#__PURE__*/React.createElement("span", null, initial));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/media/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Иконка из набора Lucide: глиф иконочного шрифта, наследует color. */
function Icon({
  name,
  size = 20,
  color,
  className = '',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("i", _extends({
    className: ['v-icon', 'icon-' + name, className].filter(Boolean).join(' '),
    "aria-hidden": "true",
    style: {
      fontSize: size,
      color,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/Icon.jsx", error: String((e && e.message) || e) }); }

// components/actions/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Чип-фильтр: категории услуг, длительность, «только свободные». */
function Chip({
  selected = false,
  icon,
  disabled = false,
  interactive = true,
  className = '',
  children,
  ...rest
}) {
  const cls = ['v-chip', selected && 'v-chip--selected', !interactive && 'v-chip--static', className].filter(Boolean).join(' ');
  const glyph = typeof icon === 'string' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  }) : icon;
  if (!interactive) return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), glyph, children);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    "aria-pressed": selected,
    disabled: disabled
  }, rest), glyph, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Chip.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Круглая иконочная кнопка: назад, поделиться, избранное, «ещё». Всегда с aria-label. */
function IconButton({
  icon,
  label,
  variant = 'plain',
  size = 'md',
  disabled = false,
  className = '',
  ...rest
}) {
  const cls = ['v-icon-btn', `v-icon-btn--${variant}`, size !== 'md' && `v-icon-btn--${size}`, className].filter(Boolean).join(' ');
  const glyph = typeof icon === 'string' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 16 : 20
  }) : icon;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    "aria-label": label,
    title: label,
    disabled: disabled
  }, rest), glyph);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/booking/BookingCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Карточка записи в списке «Мои записи» и в админке: когда, что, у кого, статус. */
function BookingCard({
  when,
  service,
  master,
  masterPhoto,
  price,
  address,
  status = 'confirmed',
  actions,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    className: ['v-booking-card', status === 'cancelled' && 'v-booking-card--cancelled', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "v-booking-card__head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "v-booking-card__when"
  }, when), /*#__PURE__*/React.createElement("div", {
    className: "v-booking-card__service"
  }, service)), /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: status,
    short: true
  })), master ? /*#__PURE__*/React.createElement("div", {
    className: "v-booking-card__row"
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: master,
    src: masterPhoto,
    size: 28
  }), master, price ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto'
    },
    className: "v-num"
  }, price)) : null) : null, address ? /*#__PURE__*/React.createElement("div", {
    className: "v-booking-card__row"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "map-pin",
    size: 15
  }), address) : null, actions ? /*#__PURE__*/React.createElement("div", {
    className: "v-booking-card__foot"
  }, actions) : null);
}
Object.assign(__ds_scope, { BookingCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/BookingCard.jsx", error: String((e && e.message) || e) }); }

// components/booking/ServiceCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const formatPrice = p => typeof p === 'number' ? p.toLocaleString('ru-RU') + ' ₽' : p;

/** Карточка услуги: название, описание, длительность и цена. */
function ServiceCard({
  title,
  description,
  duration,
  price,
  from = false,
  badge,
  selected = false,
  onClick,
  className = '',
  ...rest
}) {
  const interactive = Boolean(onClick);
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    variant: "tight",
    interactive: interactive,
    selected: selected,
    onClick: onClick,
    className: className
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "v-service-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-service-card__body"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-service-card__title"
  }, title), description ? /*#__PURE__*/React.createElement("span", {
    className: "v-service-card__desc"
  }, description) : null, /*#__PURE__*/React.createElement("span", {
    className: "v-service-card__meta"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "clock",
    size: 14
  }), duration, badge ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "v-service-card__dot"
  }), badge) : null)), /*#__PURE__*/React.createElement("div", {
    className: "v-service-card__side"
  }, from ? /*#__PURE__*/React.createElement("span", {
    className: "v-service-card__from"
  }, "\u043E\u0442") : null, /*#__PURE__*/React.createElement("span", {
    className: "v-service-card__price"
  }, formatPrice(price)))));
}
Object.assign(__ds_scope, { ServiceCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/ServiceCard.jsx", error: String((e && e.message) || e) }); }

// components/booking/SlotPicker.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Слот-пикер: сетка времени, сгруппированная по частям дня.
 *  Три состояния слота — свободен, занят (disabled), выбран. */
function SlotPicker({
  groups = [],
  value,
  onChange,
  legend = true,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['v-slot-group', className].filter(Boolean).join(' ')
  }, rest), groups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.label,
    className: "v-slot-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-slot-group__label"
  }, g.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: g.icon,
    size: 13
  }) : null, g.label), /*#__PURE__*/React.createElement("div", {
    className: "v-slot-grid"
  }, g.slots.map(s => {
    const busy = s.state === 'busy';
    const selected = s.time === value;
    return /*#__PURE__*/React.createElement("button", {
      key: s.time,
      type: "button",
      className: ['v-slot', busy && 'v-slot--busy', selected && 'v-slot--selected'].filter(Boolean).join(' '),
      disabled: busy,
      "aria-pressed": selected,
      "aria-label": busy ? `${s.time} — занято` : s.time,
      onClick: () => onChange && onChange(s.time)
    }, s.time);
  })))), legend ? /*#__PURE__*/React.createElement("div", {
    className: "v-slot-legend"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-slot-legend__item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-slot-legend__swatch"
  }), "\u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E"), /*#__PURE__*/React.createElement("span", {
    className: "v-slot-legend__item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-slot-legend__swatch v-slot-legend__swatch--busy"
  }), "\u0437\u0430\u043D\u044F\u0442\u043E"), /*#__PURE__*/React.createElement("span", {
    className: "v-slot-legend__item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-slot-legend__swatch v-slot-legend__swatch--selected"
  }), "\u0432\u044B\u0431\u0440\u0430\u043D\u043E")) : null);
}
Object.assign(__ds_scope, { SlotPicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/SlotPicker.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Notice.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const NOTICE_ICONS = {
  info: 'info',
  success: 'check',
  warning: 'clock',
  danger: 'circle-alert'
};

/** Встроенная подсказка/предупреждение внутри потока: правила отмены, занятый слот. */
function Notice({
  tone = 'info',
  title,
  icon,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['v-notice', `v-notice--${tone}`, className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || NOTICE_ICONS[tone],
    size: 18,
    className: "v-notice__icon"
  }), /*#__PURE__*/React.createElement("div", null, title ? /*#__PURE__*/React.createElement("div", {
    className: "v-notice__title"
  }, title) : null, /*#__PURE__*/React.createElement("div", null, children)));
}
Object.assign(__ds_scope, { Notice });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Notice.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Однострочное поле: имя, телефон, промокод. Высота 52 — комфортно с телефона. */
function Input({
  label,
  hint,
  error,
  required = false,
  iconLeft,
  iconRight,
  id,
  className = '',
  ...rest
}) {
  const inputId = id || `v-input-${label ? label.replace(/\s+/g, '-').toLowerCase() : Math.random().toString(36).slice(2, 7)}`;
  const cls = ['v-input', iconLeft && 'v-input--has-left', iconRight && 'v-input--has-right', error && 'v-input--invalid', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: "v-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "v-field__label",
    htmlFor: inputId
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__req"
  }, " *") : null) : null, /*#__PURE__*/React.createElement("div", {
    className: "v-input-wrap"
  }, iconLeft ? /*#__PURE__*/React.createElement("span", {
    className: "v-input-wrap__addon v-input-wrap__addon--left"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: 18
  })) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    className: cls,
    "aria-invalid": error ? true : undefined
  }, rest)), iconRight ? /*#__PURE__*/React.createElement("span", {
    className: "v-input-wrap__addon v-input-wrap__addon--right"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: 18
  })) : null), error ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__error"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "circle-alert",
    size: 13
  }), error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "v-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/media/ImageFrame.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Рамка для фото работ и портретов мастеров. Без src — глянцевая заглушка с подписью. */
function ImageFrame({
  src,
  alt = '',
  ratio = '1 / 1',
  height,
  tone = 'nude',
  label = 'Фото',
  radius,
  className = '',
  style,
  ...rest
}) {
  const cls = ['v-image-frame', tone !== 'nude' && `v-image-frame--${tone}`, className].filter(Boolean).join(' ');
  const box = {
    aspectRatio: height ? undefined : ratio,
    height,
    borderRadius: radius,
    ...style
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    style: box
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt
  }) : /*#__PURE__*/React.createElement("span", {
    className: "v-image-frame__placeholder"
  }, label));
}
Object.assign(__ds_scope, { ImageFrame });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/ImageFrame.jsx", error: String((e && e.message) || e) }); }

// components/booking/MasterCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Карточка мастера: фото, имя, специализация, рейтинг и мини-портфолио. */
function MasterCard({
  name,
  role,
  photo,
  rating,
  reviews,
  works = [],
  layout = 'row',
  selected = false,
  onClick,
  action,
  className = '',
  ...rest
}) {
  const interactive = Boolean(onClick);
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    variant: "tight",
    interactive: interactive,
    selected: selected,
    onClick: onClick,
    className: className
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: ['v-master-card', layout === 'stacked' && 'v-master-card--stacked'].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement(__ds_scope.ImageFrame, {
    src: photo,
    alt: name,
    label: name,
    className: "v-master-card__photo"
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-master-card__body"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-master-card__name"
  }, name), role ? /*#__PURE__*/React.createElement("span", {
    className: "v-master-card__role"
  }, role) : null, /*#__PURE__*/React.createElement("div", {
    className: "v-master-card__meta"
  }, rating != null ? /*#__PURE__*/React.createElement(__ds_scope.Rating, {
    value: rating,
    count: reviews
  }) : null, action), works.length > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "v-master-card__works"
  }, works.slice(0, 4).map((w, i) => /*#__PURE__*/React.createElement(__ds_scope.ImageFrame, {
    key: i,
    src: w,
    label: "",
    className: "v-master-card__work"
  }))) : null), interactive && layout === 'row' ? /*#__PURE__*/React.createElement("span", {
    className: "v-master-card__chevron icon-chevron-right"
  }) : null));
}
Object.assign(__ds_scope, { MasterCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/MasterCard.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BottomNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Нижняя навигация мини-аппа: 3–4 раздела, подпись всегда видна. */
function BottomNav({
  items = [],
  value,
  onChange,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    className: ['v-bottom-nav', className].filter(Boolean).join(' ')
  }, rest), items.map(it => {
    const active = it.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      type: "button",
      className: ['v-bottom-nav__item', active && 'v-bottom-nav__item--active'].filter(Boolean).join(' '),
      "aria-current": active ? 'page' : undefined,
      onClick: () => onChange && onChange(it.id)
    }, /*#__PURE__*/React.createElement("span", {
      className: "v-bottom-nav__icon"
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 22
    }), it.badge ? /*#__PURE__*/React.createElement("span", {
      className: "v-bottom-nav__badge"
    }, it.badge) : null), it.label);
  }));
}
Object.assign(__ds_scope, { BottomNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BottomNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Stepper.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Шаги записи: мастер → услуга → время → подтверждение. Максимум 4 шага. */
function Stepper({
  steps = [],
  current = 0,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['v-stepper', className].filter(Boolean).join(' ')
  }, rest), steps.map((label, i) => {
    const state = i < current ? 'done' : i === current ? 'active' : 'todo';
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: label
    }, /*#__PURE__*/React.createElement("div", {
      className: ['v-stepper__step', state !== 'todo' && `v-stepper__step--${state}`].filter(Boolean).join(' ')
    }, /*#__PURE__*/React.createElement("span", {
      className: "v-stepper__bullet"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "v-stepper__label"
    }, label)), i < steps.length - 1 ? /*#__PURE__*/React.createElement("span", {
      className: "v-stepper__line"
    }) : null);
  }));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Верхняя панель экрана: назад + заголовок по центру + действие справа. */
function TopBar({
  title,
  onBack,
  right,
  align = 'center',
  plain = false,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    className: ['v-top-bar', plain && 'v-top-bar--plain', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "v-top-bar__side",
    style: {
      justifyContent: 'flex-start'
    }
  }, onBack ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-left",
    label: "\u041D\u0430\u0437\u0430\u0434",
    onClick: onBack
  }) : null), /*#__PURE__*/React.createElement("div", {
    className: ['v-top-bar__title', align === 'start' && 'v-top-bar__title--start'].filter(Boolean).join(' ')
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "v-top-bar__side"
  }, right));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/admin-data.js
try { (() => {
window.NOGOTOCHKI_ADMIN = {
  day: '15 августа, суббота',
  masters: [{
    id: 'anna',
    name: 'Анна',
    role: 'Маникюр, наращивание'
  }, {
    id: 'lena',
    name: 'Лена',
    role: 'Педикюр, маникюр'
  }, {
    id: 'aya',
    name: 'Ая',
    role: 'Дизайн, наращивание'
  }],
  appointments: [{
    id: 1,
    master: 'anna',
    start: '10:00',
    min: 90,
    client: 'Марина К.',
    service: 'Маникюр с покрытием',
    price: '3 200 ₽',
    status: 'confirmed'
  }, {
    id: 2,
    master: 'anna',
    start: '12:00',
    min: 180,
    client: 'Ольга П.',
    service: 'Наращивание',
    price: '5 500 ₽',
    status: 'confirmed'
  }, {
    id: 3,
    master: 'anna',
    start: '18:00',
    min: 90,
    client: 'Марина К.',
    service: 'Маникюр с покрытием',
    price: '3 200 ₽',
    status: 'pending'
  }, {
    id: 4,
    master: 'lena',
    start: '11:00',
    min: 100,
    client: 'Ирина С.',
    service: 'Педикюр с покрытием',
    price: '3 800 ₽',
    status: 'confirmed'
  }, {
    id: 5,
    master: 'lena',
    start: '14:00',
    min: 50,
    client: 'Женя Т.',
    service: 'Маникюр без покрытия',
    price: '1 900 ₽',
    status: 'cancelled'
  }, {
    id: 6,
    master: 'lena',
    start: '16:00',
    min: 100,
    client: 'Алина В.',
    service: 'Педикюр с покрытием',
    price: '3 800 ₽',
    status: 'confirmed'
  }, {
    id: 7,
    master: 'aya',
    start: '10:30',
    min: 180,
    client: 'Катя Л.',
    service: 'Наращивание',
    price: '5 500 ₽',
    status: 'confirmed'
  }, {
    id: 8,
    master: 'aya',
    start: '15:00',
    min: 60,
    client: 'Настя Р.',
    service: 'Дизайн ногтей',
    price: '1 200 ₽',
    status: 'pending'
  }],
  rows: [{
    id: 1042,
    when: '15 авг · 18:00',
    client: 'Марина К.',
    phone: '+7 921 000-00-00',
    service: 'Маникюр с покрытием',
    master: 'Анна',
    price: '3 200 ₽',
    status: 'pending',
    source: 'Telegram'
  }, {
    id: 1041,
    when: '15 авг · 16:00',
    client: 'Алина В.',
    phone: '+7 911 111-11-11',
    service: 'Педикюр с покрытием',
    master: 'Лена',
    price: '3 800 ₽',
    status: 'confirmed',
    source: 'Telegram'
  }, {
    id: 1040,
    when: '15 авг · 15:00',
    client: 'Настя Р.',
    phone: '+7 999 222-22-22',
    service: 'Дизайн ногтей',
    master: 'Ая',
    price: '1 200 ₽',
    status: 'pending',
    source: 'Сайт'
  }, {
    id: 1039,
    when: '15 авг · 14:00',
    client: 'Женя Т.',
    phone: '+7 903 333-33-33',
    service: 'Маникюр без покрытия',
    master: 'Лена',
    price: '1 900 ₽',
    status: 'cancelled',
    source: 'Сайт'
  }, {
    id: 1038,
    when: '15 авг · 12:00',
    client: 'Ольга П.',
    phone: '+7 905 444-44-44',
    service: 'Наращивание',
    master: 'Анна',
    price: '5 500 ₽',
    status: 'confirmed',
    source: 'Telegram'
  }, {
    id: 1037,
    when: '14 авг · 19:30',
    client: 'Даша И.',
    phone: '+7 906 555-55-55',
    service: 'Маникюр с покрытием',
    master: 'Анна',
    price: '3 200 ₽',
    status: 'done',
    source: 'Telegram'
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/admin-data.js", error: String((e && e.message) || e) }); }

// ui_kits/admin/admin.jsx
try { (() => {
/* Админка владелицы: расписание дня, записи, услуги, настройки. */

const ADM_START = 600; // 10:00 в минутах
const ADM_ROWS = 22; // до 21:00, шаг 30 минут
const toMin = t => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
function Sidebar({
  view,
  setView
}) {
  const D = window.DesignSystem_f8f42b;
  const items = [['day', 'calendar-days', 'Расписание'], ['list', 'list', 'Записи'], ['services', 'sparkles', 'Услуги'], ['settings', 'settings', 'Настройки']];
  return /*#__PURE__*/React.createElement("aside", {
    className: "side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "side__mark"
  }, "\u0412\u0430\u0440\u0432\u0430\u0440\u0430", /*#__PURE__*/React.createElement("small", null, "\u0430\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u044C")), /*#__PURE__*/React.createElement("nav", {
    className: "side__nav"
  }, items.map(i => /*#__PURE__*/React.createElement("button", {
    key: i[0],
    className: 'side__i' + (view === i[0] ? ' side__i--on' : ''),
    onClick: () => setView(i[0])
  }, /*#__PURE__*/React.createElement(D.Icon, {
    name: i[1],
    size: 18
  }), i[2]))), /*#__PURE__*/React.createElement("div", {
    className: "side__foot"
  }, /*#__PURE__*/React.createElement(D.Avatar, {
    name: "\u0412\u0430\u0440\u0432\u0430\u0440\u0430",
    size: 32
  }), "\u0412\u0430\u0440\u0432\u0430\u0440\u0430 \xB7 \u0432\u043B\u0430\u0434\u0435\u043B\u0438\u0446\u0430"));
}
function DayView({
  onSelect
}) {
  const D = window.DesignSystem_f8f42b;
  const A = window.NOGOTOCHKI_ADMIN;
  const times = Array.from({
    length: ADM_ROWS
  }, (_, i) => ADM_START + i * 30).filter((_, i) => i % 2 === 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "kpis"
  }, [['8', 'записей на сегодня'], ['26 900 ₽', 'ожидаемая выручка'], ['2', 'ждут подтверждения'], ['4', 'свободных окна']].map(k => /*#__PURE__*/React.createElement(D.Card, {
    key: k[1],
    variant: "tight"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi__v"
  }, k[0]), /*#__PURE__*/React.createElement("div", {
    className: "kpi__l"
  }, k[1])))), /*#__PURE__*/React.createElement("div", {
    className: "sched"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sched__h",
    style: {
      borderRight: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-caption"
  }, A.day)), A.masters.map(m => /*#__PURE__*/React.createElement("div", {
    className: "sched__h",
    key: m.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "sched__name"
  }, m.name), /*#__PURE__*/React.createElement("div", {
    className: "sched__role"
  }, m.role))), /*#__PURE__*/React.createElement("div", {
    className: "sched__times",
    style: {
      gridTemplateRows: `repeat(${ADM_ROWS / 2}, 68px)`
    }
  }, times.map(t => /*#__PURE__*/React.createElement("div", {
    className: "sched__t",
    key: t
  }, String(Math.floor(t / 60)).padStart(2, '0'), ":00"))), A.masters.map(m => /*#__PURE__*/React.createElement("div", {
    className: "sched__col",
    key: m.id,
    style: {
      gridTemplateRows: `repeat(${ADM_ROWS}, 34px)`
    }
  }, Array.from({
    length: ADM_ROWS
  }, (_, i) => /*#__PURE__*/React.createElement("div", {
    className: "sched__cell",
    key: i,
    style: {
      gridRow: i + 1,
      gridColumn: 1
    }
  })), A.appointments.filter(a => a.master === m.id).map(a => {
    const row = (toMin(a.start) - ADM_START) / 30 + 1;
    return /*#__PURE__*/React.createElement("div", {
      key: a.id,
      className: 'appt appt--' + a.status,
      style: {
        gridRow: `${row} / span ${a.min / 30}`,
        gridColumn: 1,
        zIndex: 2
      },
      onClick: () => onSelect(a)
    }, /*#__PURE__*/React.createElement("b", null, a.start, " \xB7 ", a.client), a.service);
  })))), /*#__PURE__*/React.createElement("div", {
    className: "v-caption"
  }, "\u0413\u043B\u0438\u043D\u044F\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u2014 \u0437\u0430\u043F\u0438\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430, \u043C\u0435\u0434\u043E\u0432\u0430\u044F \u2014 \u0436\u0434\u0451\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F, \u0437\u0430\u0447\u0451\u0440\u043A\u043D\u0443\u0442\u0430\u044F \u043F\u0435\u0441\u043E\u0447\u043D\u0430\u044F \u2014 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430."));
}
function ListView() {
  const D = window.DesignSystem_f8f42b;
  const A = window.NOGOTOCHKI_ADMIN;
  const [f, setF] = React.useState('Все');
  const map = {
    'Все': null,
    'Ждут подтверждения': 'pending',
    'Подтверждённые': 'confirmed',
    'Отменённые': 'cancelled'
  };
  const rows = map[f] ? A.rows.filter(r => r.status === map[f]) : A.rows;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "filters"
  }, Object.keys(map).map(k => /*#__PURE__*/React.createElement(D.Chip, {
    key: k,
    selected: f === k,
    onClick: () => setF(k)
  }, k)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      width: 260
    }
  }, /*#__PURE__*/React.createElement(D.Input, {
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0438\u043C\u0435\u043D\u0438 \u0438\u043B\u0438 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443",
    iconLeft: "search"
  }))), /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\u041A\u043E\u0433\u0434\u0430"), /*#__PURE__*/React.createElement("th", null, "\u041A\u043B\u0438\u0435\u043D\u0442"), /*#__PURE__*/React.createElement("th", null, "\u0423\u0441\u043B\u0443\u0433\u0430"), /*#__PURE__*/React.createElement("th", null, "\u041C\u0430\u0441\u0442\u0435\u0440"), /*#__PURE__*/React.createElement("th", null, "\u0421\u0443\u043C\u043C\u0430"), /*#__PURE__*/React.createElement("th", null, "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A"), /*#__PURE__*/React.createElement("th", null, "\u0421\u0442\u0430\u0442\u0443\u0441"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "c"
  }, r.when), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "c"
  }, r.client), /*#__PURE__*/React.createElement("div", {
    className: "v-caption"
  }, r.phone)), /*#__PURE__*/React.createElement("td", null, r.service), /*#__PURE__*/React.createElement("td", null, r.master), /*#__PURE__*/React.createElement("td", {
    className: "c v-num"
  }, r.price), /*#__PURE__*/React.createElement("td", null, r.source), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(D.StatusBadge, {
    status: r.status,
    short: true
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, r.status === 'pending' ? /*#__PURE__*/React.createElement(D.Button, {
    size: "sm"
  }, "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C") : /*#__PURE__*/React.createElement(D.IconButton, {
    icon: "ellipsis",
    label: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F",
    size: "sm"
  })))))));
}
function ServicesView() {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  return /*#__PURE__*/React.createElement("div", {
    className: "two"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, data.services.map(s => /*#__PURE__*/React.createElement(D.Card, {
    key: s.id,
    variant: "tight"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-h4"
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "v-body-sm"
  }, s.duration, s.description ? ' · ' + s.description : '')), /*#__PURE__*/React.createElement("div", {
    className: "v-price"
  }, (s.from ? 'от ' : '') + s.price.toLocaleString('ru-RU'), " \u20BD"), /*#__PURE__*/React.createElement(D.Switch, {
    defaultChecked: s.id !== 'repair'
  }), /*#__PURE__*/React.createElement(D.IconButton, {
    icon: "pencil",
    label: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
    variant: "outline",
    size: "sm"
  }))))), /*#__PURE__*/React.createElement(D.Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: 12
    }
  }, "\u041D\u043E\u0432\u0430\u044F \u0443\u0441\u043B\u0443\u0433\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(D.Input, {
    label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
    placeholder: "\u041C\u0430\u043D\u0438\u043A\u044E\u0440 \u0441 \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u0435\u043C",
    required: true
  }), /*#__PURE__*/React.createElement(D.Input, {
    label: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
    placeholder: "1 \u0447 30 \u043C\u0438\u043D",
    iconLeft: "clock",
    required: true
  }), /*#__PURE__*/React.createElement(D.Input, {
    label: "\u0426\u0435\u043D\u0430, \u20BD",
    placeholder: "3200",
    required: true
  }), /*#__PURE__*/React.createElement(D.Select, {
    label: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F",
    options: ['Маникюр', 'Педикюр', 'Наращивание', 'Дизайн'],
    placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435"
  }), /*#__PURE__*/React.createElement(D.Checkbox, {
    label: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u043E\u043D\u043B\u0430\u0439\u043D-\u0437\u0430\u043F\u0438\u0441\u0438",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(D.Button, {
    block: true
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0441\u043B\u0443\u0433\u0443"))));
}
function SettingsView() {
  const D = window.DesignSystem_f8f42b;
  return /*#__PURE__*/React.createElement("div", {
    className: "two"
  }, /*#__PURE__*/React.createElement(D.Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: 8
    }
  }, "\u0417\u0430\u043F\u0438\u0441\u044C \u0438 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F"), [['Онлайн-запись включена', 'Клиенты видят свободные окна в боте и на сайте'], ['Подтверждать записи вручную', 'Новая запись приходит со статусом «ожидает»'], ['Напоминание за 2 часа', 'Бот пишет клиентке перед визитом'], ['Уведомлять о новых записях', 'Сообщение в Telegram владелице']].map((r, i) => /*#__PURE__*/React.createElement("div", {
    className: "set__row",
    key: r[0]
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "set__t"
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    className: "set__d"
  }, r[1])), /*#__PURE__*/React.createElement(D.Switch, {
    defaultChecked: i !== 1
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(D.Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: 12
    }
  }, "\u0427\u0430\u0441\u044B \u0440\u0430\u0431\u043E\u0442\u044B"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(D.Input, {
    label: "\u041F\u043D\u2013\u0421\u0431",
    defaultValue: "10:00 \u2014 21:00"
  }), /*#__PURE__*/React.createElement(D.Input, {
    label: "\u0412\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u0435",
    defaultValue: "\u0412\u044B\u0445\u043E\u0434\u043D\u043E\u0439"
  }), /*#__PURE__*/React.createElement(D.Button, {
    variant: "secondary",
    block: true
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"))), /*#__PURE__*/React.createElement(D.Card, {
    variant: "accent"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-h4"
  }, "\u0411\u043E\u0442 \u0437\u0430\u043F\u0438\u0441\u0438"), /*#__PURE__*/React.createElement("p", {
    className: "v-body-sm",
    style: {
      marginTop: 6
    }
  }, "@nogotochki_bot \xB7 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(D.Button, {
    variant: "secondary",
    size: "sm"
  }, "\u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u0431\u043E\u0442\u0430")))));
}
Object.assign(window, {
  Sidebar,
  DayView,
  ListView,
  ServicesView,
  SettingsView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/admin.jsx", error: String((e && e.message) || e) }); }

// ui_kits/telegram_mini_app/account.jsx
try { (() => {
/* Экраны «Мои записи» и «Профиль». */

function MyBookingsScreen({
  onBook
}) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  const upcoming = data.bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
  const past = data.bookings.filter(b => b.status === 'done' || b.status === 'cancelled');
  return /*#__PURE__*/React.createElement("div", {
    className: "scr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hello"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hello__title"
  }, "\u041C\u043E\u0438 \u0437\u0430\u043F\u0438\u0441\u0438")), /*#__PURE__*/React.createElement("div", {
    className: "scr__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "list"
  }, upcoming.map(b => /*#__PURE__*/React.createElement(D.BookingCard, {
    key: b.id,
    when: b.when,
    service: b.service,
    master: b.master,
    price: b.price,
    address: b.address,
    status: b.status,
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(D.Button, {
      variant: "secondary",
      size: "sm"
    }, "\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438"), /*#__PURE__*/React.createElement(D.Button, {
      variant: "ghost",
      size: "sm"
    }, "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C"))
  }))), /*#__PURE__*/React.createElement("div", {
    className: "v-overline",
    style: {
      marginTop: 8
    }
  }, "\u0418\u0441\u0442\u043E\u0440\u0438\u044F"), /*#__PURE__*/React.createElement("div", {
    className: "list"
  }, past.map(b => /*#__PURE__*/React.createElement(D.BookingCard, {
    key: b.id,
    when: b.when,
    service: b.service,
    master: b.master,
    price: b.price,
    status: b.status,
    actions: /*#__PURE__*/React.createElement(D.Button, {
      variant: "soft",
      size: "sm",
      onClick: onBook
    }, "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C")
  })))));
}
function ProfileScreen() {
  const D = window.DesignSystem_f8f42b;
  return /*#__PURE__*/React.createElement("div", {
    className: "scr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hello"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hello__title"
  }, "\u041F\u0440\u043E\u0444\u0438\u043B\u044C")), /*#__PURE__*/React.createElement("div", {
    className: "scr__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prof__head"
  }, /*#__PURE__*/React.createElement(D.Avatar, {
    name: "\u041C\u0430\u0440\u0438\u043D\u0430",
    size: 64,
    ring: true
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "prof__name"
  }, "\u041C\u0430\u0440\u0438\u043D\u0430"), /*#__PURE__*/React.createElement("div", {
    className: "v-body-sm"
  }, "+7 921 000-00-00"))), /*#__PURE__*/React.createElement(D.Card, null, /*#__PURE__*/React.createElement("div", {
    className: "prof__row"
  }, /*#__PURE__*/React.createElement("span", null, "\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u0442\u044C \u0432 Telegram"), /*#__PURE__*/React.createElement(D.Switch, {
    defaultChecked: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "prof__row"
  }, /*#__PURE__*/React.createElement("span", null, "\u041D\u043E\u0432\u044B\u0435 \u043E\u043A\u043D\u0430 \u0443 \u0412\u0430\u0440\u0432\u0430\u0440\u044B"), /*#__PURE__*/React.createElement(D.Switch, null)), /*#__PURE__*/React.createElement("div", {
    className: "prof__row"
  }, /*#__PURE__*/React.createElement("span", null, "\u0410\u043A\u0446\u0438\u0438 \u0438 \u043D\u043E\u0432\u0438\u043D\u043A\u0438"), /*#__PURE__*/React.createElement(D.Switch, null))), /*#__PURE__*/React.createElement(D.Card, {
    variant: "accent"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(D.Icon, {
    name: "map-pin",
    size: 18,
    color: "var(--clay-600)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "v-h4"
  }, "\u0421\u0430\u043D\u043A\u0442-\u041F\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433, \u0443\u043B. \u0420\u0443\u0431\u0438\u043D\u0448\u0442\u0435\u0439\u043D\u0430, 24"), /*#__PURE__*/React.createElement("p", {
    className: "v-body-sm",
    style: {
      marginTop: 4
    }
  }, "\u0412\u0442\u043E\u0440\u043E\u0439 \u044D\u0442\u0430\u0436, \u0434\u043E\u043C\u043E\u0444\u043E\u043D 24. \u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u043E 10:00\u201321:00, \u0432\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u0435 \u0432\u044B\u0445\u043E\u0434\u043D\u043E\u0439."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(D.Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(D.Icon, {
      name: "phone",
      size: 16
    })
  }, "\u041F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u044C"))))), /*#__PURE__*/React.createElement("div", {
    className: "v-overline"
  }, "\u041B\u044E\u0431\u0438\u043C\u044B\u0435 \u043C\u0430\u0441\u0442\u0435\u0440\u0430"), /*#__PURE__*/React.createElement("div", {
    className: "list"
  }, /*#__PURE__*/React.createElement(D.MasterCard, {
    name: "\u0412\u0430\u0440\u0432\u0430\u0440\u0430",
    role: "\u041C\u0430\u043D\u0438\u043A\u044E\u0440, \u043D\u0430\u0440\u0430\u0449\u0438\u0432\u0430\u043D\u0438\u0435, \u0434\u0438\u0437\u0430\u0439\u043D",
    rating: 4.9,
    reviews: 128,
    action: /*#__PURE__*/React.createElement(D.Chip, {
      interactive: false,
      icon: "heart"
    }, "\u0432 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u043C")
  }))));
}
Object.assign(window, {
  MyBookingsScreen,
  ProfileScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/telegram_mini_app/account.jsx", error: String((e && e.message) || e) }); }

// ui_kits/telegram_mini_app/app.jsx
try { (() => {
/* Оболочка мини-аппа: состояние сценария записи, верхняя панель и нижняя навигация. */

function MiniApp() {
  const D = window.DesignSystem_f8f42b;
  const [tab, setTab] = React.useState('book');
  const [step, setStep] = React.useState(0);
  const [cat, setCat] = React.useState('Все');
  const [service, setService] = React.useState(null);
  const [master, setMaster] = React.useState(null);
  const [day, setDay] = React.useState('15');
  const [time, setTime] = React.useState(null);
  const [sheet, setSheet] = React.useState(false);
  const titles = ['', 'Выбор мастера', 'Выбор времени', 'Готово'];
  const reset = () => {
    setStep(0);
    setService(null);
    setMaster(null);
    setTime(null);
  };
  let screen = null;
  if (tab === 'book' && step === 0) screen = /*#__PURE__*/React.createElement(ServicesScreen, {
    cat: cat,
    setCat: setCat,
    service: service,
    onPick: setService,
    onNext: () => setStep(1)
  });
  if (tab === 'book' && step === 1) screen = /*#__PURE__*/React.createElement(MastersScreen, {
    master: master,
    onPick: setMaster,
    onNext: () => setStep(2)
  });
  if (tab === 'book' && step === 2) screen = /*#__PURE__*/React.createElement(TimeScreen, {
    day: day,
    setDay: setDay,
    time: time,
    setTime: setTime,
    service: service,
    onNext: () => setSheet(true)
  });
  if (tab === 'book' && step === 3) screen = /*#__PURE__*/React.createElement(DoneScreen, {
    service: service,
    master: master,
    day: day,
    time: time,
    onMy: () => {
      setTab('my');
      reset();
    }
  });
  if (tab === 'my') screen = /*#__PURE__*/React.createElement(MyBookingsScreen, {
    onBook: () => {
      setTab('book');
      reset();
    }
  });
  if (tab === 'profile') screen = /*#__PURE__*/React.createElement(ProfileScreen, null);
  return /*#__PURE__*/React.createElement("div", {
    className: "phone"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-chrome"
  }, /*#__PURE__*/React.createElement("span", null, "10:24"), /*#__PURE__*/React.createElement("span", {
    className: "tg-chrome__title"
  }, "\u0412\u0430\u0440\u0432\u0430\u0440\u0430 \xB7 \u0437\u0430\u043F\u0438\u0441\u044C"), /*#__PURE__*/React.createElement("span", {
    className: "tg-chrome__dots"
  }, "\xB7\xB7\xB7  \u2715")), tab === 'book' && step > 0 && step < 3 ? /*#__PURE__*/React.createElement(D.TopBar, {
    title: titles[step],
    onBack: () => setStep(step - 1),
    right: /*#__PURE__*/React.createElement(D.IconButton, {
      icon: "x",
      label: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C",
      onClick: reset
    })
  }) : null, screen, /*#__PURE__*/React.createElement("div", {
    className: "navwrap"
  }, /*#__PURE__*/React.createElement(D.BottomNav, {
    value: tab,
    onChange: t => {
      setTab(t);
      if (t === 'book') reset();
    },
    items: [{
      id: 'book',
      icon: 'sparkles',
      label: 'Записаться'
    }, {
      id: 'my',
      icon: 'calendar-check',
      label: 'Мои записи',
      badge: 2
    }, {
      id: 'profile',
      icon: 'user',
      label: 'Профиль'
    }]
  })), /*#__PURE__*/React.createElement(ConfirmSheet, {
    open: sheet,
    onClose: () => setSheet(false),
    onSubmit: () => {
      setSheet(false);
      setStep(3);
    },
    service: service,
    master: master,
    day: day,
    time: time
  }));
}
Object.assign(window, {
  MiniApp
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/telegram_mini_app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/telegram_mini_app/booking-flow.jsx
try { (() => {
/* Экраны записи: услуга → мастер → время → подтверждение → готово.
   Компоненты берутся из собранной библиотеки дизайн-системы (window.DesignSystem_f8f42b). */

function ServicesScreen({
  cat,
  setCat,
  service,
  onPick,
  onNext
}) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  const cats = ['Все', 'Маникюр', 'Педикюр', 'Наращивание', 'Дизайн'];
  const list = cat === 'Все' ? data.services : data.services.filter(s => s.cat === cat);
  return /*#__PURE__*/React.createElement("div", {
    className: "scr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hello"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hello__hi"
  }, "\u0414\u043E\u0431\u0440\u044B\u0439 \u0434\u0435\u043D\u044C, \u041C\u0430\u0440\u0438\u043D\u0430"), /*#__PURE__*/React.createElement("div", {
    className: "hello__title"
  }, "\u0427\u0442\u043E \u0434\u0435\u043B\u0430\u0435\u043C \u0441\u0435\u0433\u043E\u0434\u043D\u044F?")), /*#__PURE__*/React.createElement("div", {
    className: "filters"
  }, cats.map(c => /*#__PURE__*/React.createElement(D.Chip, {
    key: c,
    selected: c === cat,
    onClick: () => setCat(c)
  }, c))), /*#__PURE__*/React.createElement("div", {
    className: "scr__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "list"
  }, list.map(s => /*#__PURE__*/React.createElement(D.ServiceCard, {
    key: s.id,
    title: s.title,
    description: s.description,
    duration: s.duration,
    price: s.price,
    from: s.from,
    badge: s.badge,
    selected: service && service.id === s.id,
    onClick: () => onPick(s)
  }))), /*#__PURE__*/React.createElement(D.Notice, {
    tone: "info"
  }, "\u041E\u0442\u043C\u0435\u043D\u0430 \u0438 \u043F\u0435\u0440\u0435\u043D\u043E\u0441 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B \u0437\u0430 4 \u0447\u0430\u0441\u0430 \u0434\u043E \u0432\u0438\u0437\u0438\u0442\u0430.")), service ? /*#__PURE__*/React.createElement("div", {
    className: "scr__cta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr__cta-meta"
  }, /*#__PURE__*/React.createElement("span", null, service.title), /*#__PURE__*/React.createElement("span", {
    className: "scr__cta-price"
  }, service.from ? 'от ' : '', service.price.toLocaleString('ru-RU'), " \u20BD")), /*#__PURE__*/React.createElement(D.Button, {
    block: true,
    size: "lg",
    onClick: onNext
  }, "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0441\u0442\u0435\u0440\u0430")) : null);
}
function MastersScreen({
  master,
  onPick,
  onNext
}) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  return /*#__PURE__*/React.createElement("div", {
    className: "scr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stepwrap"
  }, /*#__PURE__*/React.createElement(D.Stepper, {
    steps: ['Услуга', 'Мастер', 'Время', 'Готово'],
    current: 1
  })), /*#__PURE__*/React.createElement("div", {
    className: "scr__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "list"
  }, /*#__PURE__*/React.createElement(D.Card, {
    variant: "tight",
    interactive: true,
    selected: master && master.id === 'any',
    onClick: () => onPick({
      id: 'any',
      name: 'Любой свободный'
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(D.Icon, {
    name: "sparkles",
    size: 20,
    color: "var(--clay-600)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "v-h4"
  }, "\u041B\u044E\u0431\u043E\u0439 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0439 \u043C\u0430\u0441\u0442\u0435\u0440"), /*#__PURE__*/React.createElement("div", {
    className: "v-body-sm"
  }, "\u0411\u043E\u043B\u044C\u0448\u0435 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0445 \u043E\u043A\u043E\u043D")))), data.masters.map(m => /*#__PURE__*/React.createElement(D.MasterCard, {
    key: m.id,
    name: m.name,
    role: m.role,
    rating: m.rating,
    reviews: m.reviews,
    works: ['', '', '', ''],
    selected: master && master.id === m.id,
    onClick: () => onPick(m)
  })))), master ? /*#__PURE__*/React.createElement("div", {
    className: "scr__cta"
  }, /*#__PURE__*/React.createElement(D.Button, {
    block: true,
    size: "lg",
    onClick: onNext
  }, "\u041A \u0432\u044B\u0431\u043E\u0440\u0443 \u0432\u0440\u0435\u043C\u0435\u043D\u0438")) : null);
}
function TimeScreen({
  day,
  setDay,
  time,
  setTime,
  service,
  onNext
}) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  return /*#__PURE__*/React.createElement("div", {
    className: "scr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stepwrap"
  }, /*#__PURE__*/React.createElement(D.Stepper, {
    steps: ['Услуга', 'Мастер', 'Время', 'Готово'],
    current: 2
  })), /*#__PURE__*/React.createElement("div", {
    className: "scr__body"
  }, /*#__PURE__*/React.createElement(D.DateStrip, {
    days: data.days,
    value: day,
    onChange: d => {
      setDay(d);
      setTime(null);
    }
  }), /*#__PURE__*/React.createElement(D.SlotPicker, {
    groups: data.slotGroups,
    value: time,
    onChange: setTime
  })), /*#__PURE__*/React.createElement("div", {
    className: "scr__cta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr__cta-meta"
  }, /*#__PURE__*/React.createElement("span", null, time ? `${day} августа, ${time}` : 'Выберите время'), /*#__PURE__*/React.createElement("span", {
    className: "scr__cta-price"
  }, service ? (service.from ? 'от ' : '') + service.price.toLocaleString('ru-RU') + ' ₽' : '')), /*#__PURE__*/React.createElement(D.Button, {
    block: true,
    size: "lg",
    disabled: !time,
    onClick: onNext
  }, "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C")));
}
function ConfirmSheet({
  open,
  onClose,
  onSubmit,
  service,
  master,
  day,
  time
}) {
  const D = window.DesignSystem_f8f42b;
  if (!service) return null;
  return /*#__PURE__*/React.createElement(D.BottomSheet, {
    open: open,
    title: "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C",
    onClose: onClose,
    footer: /*#__PURE__*/React.createElement(D.Button, {
      block: true,
      size: "lg",
      onClick: onSubmit
    }, "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F")
  }, /*#__PURE__*/React.createElement("div", {
    className: "sum",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sum__row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sum__k"
  }, "\u0423\u0441\u043B\u0443\u0433\u0430"), /*#__PURE__*/React.createElement("span", {
    className: "sum__v"
  }, service.title)), /*#__PURE__*/React.createElement("div", {
    className: "sum__row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sum__k"
  }, "\u041C\u0430\u0441\u0442\u0435\u0440"), /*#__PURE__*/React.createElement("span", {
    className: "sum__v"
  }, master ? master.name : 'Любой свободный')), /*#__PURE__*/React.createElement("div", {
    className: "sum__row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sum__k"
  }, "\u041A\u043E\u0433\u0434\u0430"), /*#__PURE__*/React.createElement("span", {
    className: "sum__v"
  }, day, " \u0430\u0432\u0433\u0443\u0441\u0442\u0430, ", time)), /*#__PURE__*/React.createElement("div", {
    className: "sum__row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sum__k"
  }, "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C"), /*#__PURE__*/React.createElement("span", {
    className: "sum__v"
  }, service.duration)), /*#__PURE__*/React.createElement("div", {
    className: "sum__row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sum__k"
  }, "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C"), /*#__PURE__*/React.createElement("span", {
    className: "sum__v v-price"
  }, (service.from ? 'от ' : '') + service.price.toLocaleString('ru-RU'), " \u20BD"))), /*#__PURE__*/React.createElement(D.Input, {
    label: "\u0422\u0435\u043B\u0435\u0444\u043E\u043D",
    iconLeft: "phone",
    defaultValue: "+7 921 000-00-00",
    hint: "\u041D\u0430\u043F\u043E\u043C\u043D\u0438\u043C \u0432 Telegram \u0437\u0430 2 \u0447\u0430\u0441\u0430"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(D.Checkbox, {
    label: "\u0421\u043E\u0433\u043B\u0430\u0441\u043D\u0430 \u043D\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u0434\u0430\u043D\u043D\u044B\u0445",
    defaultChecked: true
  })));
}
function DoneScreen({
  service,
  master,
  day,
  time,
  onMy
}) {
  const D = window.DesignSystem_f8f42b;
  return /*#__PURE__*/React.createElement("div", {
    className: "scr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "done"
  }, /*#__PURE__*/React.createElement("div", {
    className: "done__mark"
  }, /*#__PURE__*/React.createElement(D.Icon, {
    name: "check",
    size: 38,
    color: "var(--sage-600)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 26
    }
  }, "\u0417\u0430\u043F\u0438\u0441\u0430\u043B\u0438 \u0432\u0430\u0441"), /*#__PURE__*/React.createElement("p", {
    className: "v-body",
    style: {
      marginTop: 6
    }
  }, day, " \u0430\u0432\u0433\u0443\u0441\u0442\u0430 \u0432 ", time, ". \u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u0440\u0438\u0434\u0451\u0442 \u0432 Telegram, \u043D\u0430\u043F\u043E\u043C\u043D\u0438\u043C \u0437\u0430 \u0434\u0432\u0430 \u0447\u0430\u0441\u0430.")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(D.BookingCard, {
    when: `${day} августа · ${time}`,
    service: service ? service.title : '',
    master: master ? master.name : 'Любой свободный',
    price: service ? service.price.toLocaleString('ru-RU') + ' ₽' : '',
    status: "confirmed",
    address: "\u0443\u043B. \u0420\u0443\u0431\u0438\u043D\u0448\u0442\u0435\u0439\u043D\u0430, 24"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "scr__cta"
  }, /*#__PURE__*/React.createElement(D.Button, {
    block: true,
    size: "lg",
    variant: "secondary",
    onClick: onMy
  }, "\u041C\u043E\u0438 \u0437\u0430\u043F\u0438\u0441\u0438")));
}
Object.assign(window, {
  ServicesScreen,
  MastersScreen,
  TimeScreen,
  ConfirmSheet,
  DoneScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/telegram_mini_app/booking-flow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/telegram_mini_app/data.js
try { (() => {
window.NOGOTOCHKI_DATA = {
  services: [{
    id: 'man-cover',
    title: 'Маникюр с покрытием',
    description: 'Аппаратный, гель-лак',
    duration: '1 ч 30 мин',
    price: 3200,
    cat: 'Маникюр'
  }, {
    id: 'man',
    title: 'Маникюр без покрытия',
    description: 'Аппаратный, уход за кутикулой',
    duration: '50 мин',
    price: 1900,
    cat: 'Маникюр'
  }, {
    id: 'ext',
    title: 'Наращивание',
    description: 'Гель, форма и длина на выбор',
    duration: '3 ч',
    price: 5500,
    from: true,
    badge: 'хит',
    cat: 'Наращивание'
  }, {
    id: 'ped',
    title: 'Педикюр с покрытием',
    description: 'Медицинский аппаратный',
    duration: '1 ч 40 мин',
    price: 3800,
    cat: 'Педикюр'
  }, {
    id: 'design',
    title: 'Дизайн ногтей',
    description: 'Френч, втирка, стемпинг',
    duration: 'от 20 мин',
    price: 600,
    from: true,
    cat: 'Дизайн'
  }, {
    id: 'repair',
    title: 'Ремонт ногтя',
    duration: '15 мин',
    price: 400,
    cat: 'Маникюр'
  }],
  masters: [{
    id: 'anna',
    name: 'Анна',
    role: 'Маникюр, наращивание, дизайн',
    rating: 4.9,
    reviews: 128
  }, {
    id: 'lena',
    name: 'Лена',
    role: 'Педикюр, маникюр',
    rating: 4.8,
    reviews: 96
  }, {
    id: 'aya',
    name: 'Ая',
    role: 'Дизайн, наращивание',
    rating: 5.0,
    reviews: 41
  }],
  days: [{
    id: '15',
    dow: 'сб',
    day: 15,
    free: 4
  }, {
    id: '16',
    dow: 'вс',
    day: 16,
    disabled: true
  }, {
    id: '17',
    dow: 'пн',
    day: 17,
    free: 7
  }, {
    id: '18',
    dow: 'вт',
    day: 18,
    free: 2
  }, {
    id: '19',
    dow: 'ср',
    day: 19,
    free: 6
  }, {
    id: '20',
    dow: 'чт',
    day: 20,
    free: 5
  }, {
    id: '21',
    dow: 'пт',
    day: 21,
    free: 3
  }],
  slotGroups: [{
    label: 'Утро',
    icon: 'sunrise',
    slots: [{
      time: '10:00',
      state: 'busy'
    }, {
      time: '10:30'
    }, {
      time: '11:00'
    }, {
      time: '11:30',
      state: 'busy'
    }]
  }, {
    label: 'День',
    icon: 'sun',
    slots: [{
      time: '12:30'
    }, {
      time: '13:00',
      state: 'busy'
    }, {
      time: '14:30'
    }, {
      time: '15:00',
      state: 'busy'
    }, {
      time: '15:30'
    }, {
      time: '16:00',
      state: 'busy'
    }]
  }, {
    label: 'Вечер',
    icon: 'moon',
    slots: [{
      time: '17:30'
    }, {
      time: '18:00'
    }, {
      time: '18:30',
      state: 'busy'
    }, {
      time: '19:00'
    }]
  }],
  monthNames: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  bookings: [{
    id: 1,
    when: 'Сегодня, 15 августа · 18:00',
    service: 'Маникюр с покрытием',
    master: 'Анна',
    price: '3 200 ₽',
    status: 'confirmed',
    address: 'ул. Рубинштейна, 24'
  }, {
    id: 2,
    when: '17 августа · 12:30',
    service: 'Педикюр с покрытием',
    master: 'Лена',
    price: '3 800 ₽',
    status: 'pending',
    address: 'ул. Рубинштейна, 24'
  }, {
    id: 3,
    when: '2 августа · 15:00',
    service: 'Наращивание',
    master: 'Ая',
    price: '5 500 ₽',
    status: 'done'
  }, {
    id: 4,
    when: '26 июля · 11:00',
    service: 'Маникюр с покрытием',
    master: 'Анна',
    price: '3 200 ₽',
    status: 'cancelled'
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/telegram_mini_app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/website/booking-modal.jsx
try { (() => {
/* Модалка записи на сайте: услуга и мастер → время → контакты. */

function BookingModal({
  open,
  onClose
}) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  const [step, setStep] = React.useState(0);
  const [service, setService] = React.useState(data.services[0]);
  const [master, setMaster] = React.useState(data.masters[0]);
  const [day, setDay] = React.useState('15');
  const [time, setTime] = React.useState(null);
  if (!open) return null;
  const titles = ['Услуга и мастер', 'Дата и время', 'Ваши контакты', 'Запись подтверждена'];
  const close = () => {
    setStep(0);
    setTime(null);
    onClose();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: close
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal__box",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "\u041E\u043D\u043B\u0430\u0439\u043D-\u0437\u0430\u043F\u0438\u0441\u044C"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal__head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "v-overline",
    style: {
      marginBottom: 8
    }
  }, "\u041E\u043D\u043B\u0430\u0439\u043D-\u0437\u0430\u043F\u0438\u0441\u044C"), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 30
    }
  }, titles[step])), /*#__PURE__*/React.createElement(D.IconButton, {
    icon: "x",
    label: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
    onClick: close
  })), step < 3 ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(D.Stepper, {
    steps: ['Услуга', 'Время', 'Контакты'],
    current: step
  })) : null, step === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, data.services.slice(0, 4).map(s => /*#__PURE__*/React.createElement(D.ServiceCard, {
    key: s.id,
    title: s.title,
    duration: s.duration,
    price: s.price,
    from: s.from,
    selected: service.id === s.id,
    onClick: () => setService(s)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "v-overline"
  }, "\u041C\u0430\u0441\u0442\u0435\u0440"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, data.masters.map(m => /*#__PURE__*/React.createElement(D.Chip, {
    key: m.id,
    selected: master.id === m.id,
    onClick: () => setMaster(m)
  }, m.name)), /*#__PURE__*/React.createElement(D.Chip, {
    selected: master.id === 'any',
    onClick: () => setMaster({
      id: 'any',
      name: 'Любой свободный'
    })
  }, "\u041B\u044E\u0431\u043E\u0439 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0439"))) : null, step === 1 ? /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(D.DateStrip, {
    days: data.days,
    value: day,
    onChange: d => {
      setDay(d);
      setTime(null);
    }
  }), /*#__PURE__*/React.createElement(D.SlotPicker, {
    groups: data.slotGroups,
    value: time,
    onChange: setTime
  })) : null, step === 2 ? /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(D.Input, {
    label: "\u0418\u043C\u044F",
    placeholder: "\u041C\u0430\u0440\u0438\u043D\u0430",
    required: true
  }), /*#__PURE__*/React.createElement(D.Input, {
    label: "\u0422\u0435\u043B\u0435\u0444\u043E\u043D",
    iconLeft: "phone",
    placeholder: "+7 ___ ___-__-__",
    required: true
  })), /*#__PURE__*/React.createElement(D.TextArea, {
    label: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439",
    rows: 2,
    placeholder: "\u041F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F \u043A \u0434\u0438\u0437\u0430\u0439\u043D\u0443, \u0430\u043B\u043B\u0435\u0440\u0433\u0438\u0438, \u0432\u0441\u0451 \u0432\u0430\u0436\u043D\u043E\u0435"
  }), /*#__PURE__*/React.createElement(D.Checkbox, {
    label: "\u0421\u043E\u0433\u043B\u0430\u0441\u043D\u0430 \u043D\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(D.Notice, {
    tone: "info"
  }, "\u041E\u0442\u043C\u0435\u043D\u0430 \u0438 \u043F\u0435\u0440\u0435\u043D\u043E\u0441 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B \u0437\u0430 4 \u0447\u0430\u0441\u0430 \u0434\u043E \u0432\u0438\u0437\u0438\u0442\u0430.")) : null, step === 3 ? /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(D.Notice, {
    tone: "success",
    title: "\u0416\u0434\u0451\u043C \u0432\u0430\u0441"
  }, "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B\u0438 \u0432 Telegram \u0438 \u043D\u0430 \u0442\u0435\u043B\u0435\u0444\u043E\u043D."), /*#__PURE__*/React.createElement(D.BookingCard, {
    when: `${day} августа · ${time || '18:00'}`,
    service: service.title,
    master: master.name,
    price: service.price.toLocaleString('ru-RU') + ' ₽',
    address: "\u0443\u043B. \u0420\u0443\u0431\u0438\u043D\u0448\u0442\u0435\u0439\u043D\u0430, 24",
    status: "confirmed"
  })) : null, /*#__PURE__*/React.createElement("div", {
    className: "modal__foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal__sum"
  }, step === 3 ? 'Запись №1042' : service.title + ' · ' + (master.id === 'any' ? 'любой мастер' : master.name), /*#__PURE__*/React.createElement("b", null, step === 3 ? 'Готово' : (service.from ? 'от ' : '') + service.price.toLocaleString('ru-RU') + ' ₽ · ' + service.duration)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, step > 0 && step < 3 ? /*#__PURE__*/React.createElement(D.Button, {
    variant: "secondary",
    size: "lg",
    onClick: () => setStep(step - 1)
  }, "\u041D\u0430\u0437\u0430\u0434") : null, step < 2 ? /*#__PURE__*/React.createElement(D.Button, {
    size: "lg",
    disabled: step === 1 && !time,
    onClick: () => setStep(step + 1)
  }, "\u0414\u0430\u043B\u0435\u0435") : null, step === 2 ? /*#__PURE__*/React.createElement(D.Button, {
    size: "lg",
    onClick: () => setStep(3)
  }, "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F") : null, step === 3 ? /*#__PURE__*/React.createElement(D.Button, {
    size: "lg",
    variant: "secondary",
    onClick: close
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C") : null))));
}
Object.assign(window, {
  BookingModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/booking-modal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/site.jsx
try { (() => {
/* Секции лендинга «Ноготочки». */

function Header({
  onBook
}) {
  const D = window.DesignSystem_f8f42b;
  return /*#__PURE__*/React.createElement("header", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap hdr__in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mark"
  }, "\u0412\u0430\u0440\u0432\u0430\u0440\u0430", /*#__PURE__*/React.createElement("small", null, "\u043D\u043E\u0433\u0442\u0435\u0432\u0430\u044F \u0441\u0442\u0443\u0434\u0438\u044F")), /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#services"
  }, "\u0423\u0441\u043B\u0443\u0433\u0438"), /*#__PURE__*/React.createElement("a", {
    href: "#masters"
  }, "\u041C\u0430\u0441\u0442\u0435\u0440\u0430"), /*#__PURE__*/React.createElement("a", {
    href: "#works"
  }, "\u0420\u0430\u0431\u043E\u0442\u044B"), /*#__PURE__*/React.createElement("a", {
    href: "#contacts"
  }, "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B")), /*#__PURE__*/React.createElement(D.Button, {
    onClick: onBook
  }, "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F")));
}
function Hero({
  onBook
}) {
  const D = window.DesignSystem_f8f42b;
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap hero"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "hero__eyebrow"
  }, "\u0421\u0430\u043D\u043A\u0442-\u041F\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433 \xB7 \u0420\u0443\u0431\u0438\u043D\u0448\u0442\u0435\u0439\u043D\u0430, 24"), /*#__PURE__*/React.createElement("h1", null, "\u0410\u043A\u043A\u0443\u0440\u0430\u0442\u043D\u044B\u0435 \u043D\u043E\u0433\u0442\u0438", /*#__PURE__*/React.createElement("br", null), "\u0431\u0435\u0437 \u0441\u043F\u0435\u0448\u043A\u0438"), /*#__PURE__*/React.createElement("p", null, "\u041C\u0430\u043D\u0438\u043A\u044E\u0440, \u043F\u0435\u0434\u0438\u043A\u044E\u0440 \u0438 \u043D\u0430\u0440\u0430\u0449\u0438\u0432\u0430\u043D\u0438\u0435 \u0432 \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0439 \u0441\u0442\u0443\u0434\u0438\u0438 \u043D\u0430 \u0447\u0435\u0442\u044B\u0440\u0435 \u043A\u0440\u0435\u0441\u043B\u0430. \u041E\u0434\u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440 \u2014 \u043E\u0434\u043D\u0430 \u043A\u043B\u0438\u0435\u043D\u0442\u043A\u0430, \u0441\u0442\u0435\u0440\u0438\u043B\u044C\u043D\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B, \u0447\u0435\u0441\u0442\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F \u0432 \u0437\u0430\u043F\u0438\u0441\u0438."), /*#__PURE__*/React.createElement("div", {
    className: "hero__cta"
  }, /*#__PURE__*/React.createElement(D.Button, {
    size: "lg",
    onClick: onBook
  }, "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F \u043E\u043D\u043B\u0430\u0439\u043D"), /*#__PURE__*/React.createElement(D.Button, {
    size: "lg",
    variant: "secondary",
    as: "a",
    href: "#works"
  }, "\u0421\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u044B"))), /*#__PURE__*/React.createElement("div", {
    className: "hero__art"
  }, /*#__PURE__*/React.createElement(D.ImageFrame, {
    ratio: "4 / 5",
    radius: "40px",
    label: "\u0424\u043E\u0442\u043E \u0441\u0442\u0443\u0434\u0438\u0438 \u0438\u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u044B \u043C\u0430\u0441\u0442\u0435\u0440\u0430"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero__badge"
  }, /*#__PURE__*/React.createElement(D.Rating, {
    value: 4.9,
    count: 265
  }), /*#__PURE__*/React.createElement("span", {
    className: "v-caption"
  }, "\u0421\u0440\u0435\u0434\u043D\u044F\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0437\u0430 \u0433\u043E\u0434"))));
}
function Strip() {
  const D = window.DesignSystem_f8f42b;
  const items = [['shield-check', 'Стерильность', 'Автоклав, одноразовые файлы, всё вскрываем при вас'], ['clock', 'Честное время', 'В записи стоит реальная длительность, без «подождите ещё час»'], ['send', 'Запись в Telegram', 'Бот подтверждает окно и напоминает за два часа'], ['sparkles', 'Свои материалы', 'Гель-лаки и базы, с которыми носится 4 недели']];
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "strip"
  }, items.map(i => /*#__PURE__*/React.createElement("div", {
    className: "strip__i",
    key: i[1]
  }, /*#__PURE__*/React.createElement(D.Icon, {
    name: i[0],
    size: 20,
    color: "var(--clay-600)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "strip__t"
  }, i[1]), /*#__PURE__*/React.createElement("div", {
    className: "strip__d"
  }, i[2]))))));
}
function Services({
  onBook
}) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  const [cat, setCat] = React.useState('Все');
  const cats = ['Все', 'Маникюр', 'Педикюр', 'Наращивание', 'Дизайн'];
  const list = cat === 'Все' ? data.services : data.services.filter(s => s.cat === cat);
  return /*#__PURE__*/React.createElement("section", {
    className: "sec",
    id: "services"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(D.SectionHeader, {
    eyebrow: "\u0423\u0441\u043B\u0443\u0433\u0438",
    title: "\u0427\u0442\u043E \u043C\u044B \u0434\u0435\u043B\u0430\u0435\u043C",
    subtitle: "\u0426\u0435\u043D\u0430 \u0437\u0430 \u0440\u0430\u0431\u043E\u0442\u0443 \u0446\u0435\u043B\u0438\u043A\u043E\u043C: \u0441\u043D\u044F\u0442\u0438\u0435, \u0443\u0445\u043E\u0434 \u0438 \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u0435 \u0443\u0436\u0435 \u0432\u043D\u0443\u0442\u0440\u0438.",
    action: /*#__PURE__*/React.createElement(D.Button, {
      variant: "ghost",
      onClick: onBook
    }, "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      margin: '8px 0 24px'
    }
  }, cats.map(c => /*#__PURE__*/React.createElement(D.Chip, {
    key: c,
    selected: c === cat,
    onClick: () => setCat(c)
  }, c))), /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, list.map(s => /*#__PURE__*/React.createElement(D.ServiceCard, {
    key: s.id,
    title: s.title,
    description: s.description,
    duration: s.duration,
    price: s.price,
    from: s.from,
    badge: s.badge,
    onClick: onBook
  })))));
}
function Masters({
  onBook
}) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  return /*#__PURE__*/React.createElement("section", {
    className: "sec sec--alt",
    id: "masters"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(D.SectionHeader, {
    eyebrow: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430",
    title: "\u041C\u0430\u0441\u0442\u0435\u0440\u0430",
    subtitle: "\u0423 \u043A\u0430\u0436\u0434\u043E\u0439 \u2014 \u0441\u0432\u043E\u044F \u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u0438 \u0441\u0432\u043E\u0451 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435. \u041C\u043E\u0436\u043D\u043E \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F \u043A \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0439."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, data.masters.map(m => /*#__PURE__*/React.createElement(D.MasterCard, {
    key: m.id,
    layout: "stacked",
    name: m.name,
    role: m.role,
    rating: m.rating,
    reviews: m.reviews,
    action: /*#__PURE__*/React.createElement(D.Button, {
      variant: "secondary",
      size: "sm",
      onClick: onBook
    }, "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F")
  })))));
}
function Works() {
  const D = window.DesignSystem_f8f42b;
  const labels = ['Нюд с втиркой', 'Френч', 'Матовое покрытие', 'Наращивание, форма миндаль', 'Дизайн с фольгой', 'Педикюр'];
  return /*#__PURE__*/React.createElement("section", {
    className: "sec",
    id: "works"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(D.SectionHeader, {
    eyebrow: "\u041F\u043E\u0440\u0442\u0444\u043E\u043B\u0438\u043E",
    title: "\u0420\u0430\u0431\u043E\u0442\u044B",
    subtitle: "\u0421\u043D\u0438\u043C\u0430\u0435\u043C \u0431\u0435\u0437 \u0444\u0438\u043B\u044C\u0442\u0440\u043E\u0432, \u043F\u0440\u0438 \u0434\u043D\u0435\u0432\u043D\u043E\u043C \u0441\u0432\u0435\u0442\u0435."
  }), /*#__PURE__*/React.createElement("div", {
    className: "gallery"
  }, labels.map((l, i) => /*#__PURE__*/React.createElement(D.ImageFrame, {
    key: l,
    ratio: i === 0 ? '1 / 1' : '1 / 1',
    tone: i % 3 === 2 ? 'cream' : 'nude',
    label: l
  })))));
}
function Band({
  onBook
}) {
  const D = window.DesignSystem_f8f42b;
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap",
    style: {
      paddingBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "band"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0435 \u043E\u043A\u043D\u0430", /*#__PURE__*/React.createElement("br", null), "\u043D\u0430 \u044D\u0442\u043E\u0439 \u043D\u0435\u0434\u0435\u043B\u0435"), /*#__PURE__*/React.createElement("p", null, "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F \u2014 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u0440\u0438\u0434\u0451\u0442 \u0432 Telegram \u0437\u0430 \u043C\u0438\u043D\u0443\u0442\u0443.")), /*#__PURE__*/React.createElement(D.Button, {
    size: "lg",
    variant: "inverse",
    onClick: onBook
  }, "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F")));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    className: "ftr",
    id: "contacts"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ftr__in"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mark"
  }, "\u0412\u0430\u0440\u0432\u0430\u0440\u0430", /*#__PURE__*/React.createElement("small", null, "\u043D\u043E\u0433\u0442\u0435\u0432\u0430\u044F \u0441\u0442\u0443\u0434\u0438\u044F")), /*#__PURE__*/React.createElement("p", {
    className: "v-body-sm",
    style: {
      marginTop: 16,
      maxWidth: '32ch'
    }
  }, "\u0421\u0430\u043D\u043A\u0442-\u041F\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433, \u0443\u043B. \u0420\u0443\u0431\u0438\u043D\u0448\u0442\u0435\u0439\u043D\u0430, 24, \u0432\u0442\u043E\u0440\u043E\u0439 \u044D\u0442\u0430\u0436.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "\u0427\u0430\u0441\u044B"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, "\u041F\u043D\u2013\u0421\u0431 10:00\u201321:00"), /*#__PURE__*/React.createElement("li", null, "\u0412\u0441 \u0432\u044B\u0445\u043E\u0434\u043D\u043E\u0439"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "\u0421\u0432\u044F\u0437\u044C"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, "+7 921 000-00-00"), /*#__PURE__*/React.createElement("li", null, "@nogotochki_bot"), /*#__PURE__*/React.createElement("li", null, "hello@nogotochki.studio"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "\u0423\u0441\u043B\u0443\u0433\u0438"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, "\u041C\u0430\u043D\u0438\u043A\u044E\u0440"), /*#__PURE__*/React.createElement("li", null, "\u041F\u0435\u0434\u0438\u043A\u044E\u0440"), /*#__PURE__*/React.createElement("li", null, "\u041D\u0430\u0440\u0430\u0449\u0438\u0432\u0430\u043D\u0438\u0435"), /*#__PURE__*/React.createElement("li", null, "\u0414\u0438\u0437\u0430\u0439\u043D")))), /*#__PURE__*/React.createElement("div", {
    className: "ftr__legal"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 \u0421\u0442\u0443\u0434\u0438\u044F \xAB\u0412\u0430\u0440\u0432\u0430\u0440\u0430\xBB"), /*#__PURE__*/React.createElement("span", null, "\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445"))));
}
Object.assign(window, {
  Header,
  Hero,
  Strip,
  Services,
  Masters,
  Works,
  Band,
  Footer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/site.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.BookingCard = __ds_scope.BookingCard;

__ds_ns.DateStrip = __ds_scope.DateStrip;

__ds_ns.MasterCard = __ds_scope.MasterCard;

__ds_ns.ServiceCard = __ds_scope.ServiceCard;

__ds_ns.SlotPicker = __ds_scope.SlotPicker;

__ds_ns.Notice = __ds_scope.Notice;

__ds_ns.Rating = __ds_scope.Rating;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TextArea = __ds_scope.TextArea;

__ds_ns.BottomSheet = __ds_scope.BottomSheet;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ImageFrame = __ds_scope.ImageFrame;

__ds_ns.BottomNav = __ds_scope.BottomNav;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.TopBar = __ds_scope.TopBar;

})();
