module.exports = async (req, res) => {
  return res.status(200).json({
    version: 'v2',
    timestamp: new Date().toISOString(),
    debug: true
  });
};
