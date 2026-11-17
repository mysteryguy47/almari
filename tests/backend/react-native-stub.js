/**
 * The server tests run in plain Node, standing in for the web app. The sync
 * code asks react-native only which platform it is on.
 */
module.exports = { Platform: { OS: 'web', select: (o) => o.web ?? o.default } };
