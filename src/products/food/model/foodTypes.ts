import type { Restaurant } from './types';

const FOOD_TYPES = [
  { id: 'pizza', name: 'Pizza', pattern: /\b(?:pizza\w*|pizzeria\w*|telepizza|domino'?s)\b/i },
  {
    id: 'burgers',
    name: 'Hamburguesas',
    pattern: /\b(?:hamburgues\w*|burger\w*|mcdonald'?s)\b/i,
  },
  { id: 'sushi', name: 'Sushi', pattern: /\bsushi\w*\b/i },
  { id: 'kebab', name: 'Kebab', pattern: /\b(?:kebab\w*|doner|durum|shawarma)\b/i },
  { id: 'chicken', name: 'Pollo', pattern: /\b(?:pollo\w*|chicken|popeyes|kfc)\b/i },
  { id: 'mexican', name: 'Mexicana', pattern: /\b(?:mexican\w*|tacos?|burritos?|quesadillas?)\b/i },
  { id: 'italian', name: 'Italiana', pattern: /\b(?:italian\w*|pasta|trattoria)\b/i },
  { id: 'chinese', name: 'China', pattern: /\b(?:chin[ao]s?|wok|cantones\w*)\b/i },
  { id: 'indian', name: 'India', pattern: /\b(?:hindu\w*|india|indian|tandoori)\b/i },
];

export function getFoodTypes(restaurants: Restaurant[]) {
  const groups = FOOD_TYPES.map(({ id, name }) => ({ id, name, restaurants: [] as Restaurant[] }));
  groups.push({ id: 'other', name: 'Otros', restaurants: [] });
  for (const restaurant of restaurants) {
    // ponytail: name/description matching can miss cuisines; use catalog tags when the API provides them.
    const description = /^usa tu cuenta de uber\b/i.test(restaurant.description.trim())
      ? ''
      : restaurant.description;
    const text = `${restaurant.name} ${description}`.normalize('NFD').replace(/\p{M}/gu, '');
    const matches = FOOD_TYPES.filter(({ pattern }) => pattern.test(text)).map(({ id }) => id);
    for (const group of groups) {
      if (matches.length ? matches.includes(group.id) : group.id === 'other') {
        group.restaurants.push(restaurant);
      }
    }
  }
  return groups.filter(({ restaurants: members }) => members.length > 0);
}
