// mongoose.isValidObjectId() also accepts any 12-character string, which is
// not what we want for a URL param. Require the real 24-char hex form.
const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

module.exports = isValidObjectId;
