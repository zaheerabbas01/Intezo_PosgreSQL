export const isValidUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof id === 'string' && uuidRegex.test(id);
};

export const validateNumeric = (value, min = 0) => {
  const num = parseInt(value, 10);
  return (isNaN(num) || num < min) ? null : num;
};