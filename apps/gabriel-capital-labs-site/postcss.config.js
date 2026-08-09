// Local PostCSS config — shadows the root CreditVector app's postcss.config.js
// so this fully-isolated site never picks up Tailwind from the parent repo.
module.exports = {
  plugins: {
    autoprefixer: {},
  },
};
