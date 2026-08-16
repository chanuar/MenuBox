export default {
  '*.{js,jsx,ts,tsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{css,html,json,md}': 'prettier --write',
};
