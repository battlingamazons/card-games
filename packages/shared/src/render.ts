import { type Card, isRed, rankLabel, suitSymbol } from './cards';

/** Renders a face-up playing card as an HTML string using the shared `.card` styles from table.css. */
export function cardHtml(card: Card, extraClass = ''): string {
  const rank = rankLabel(card.rank);
  const suit = suitSymbol(card.suit);
  const colorClass = isRed(card.suit) ? 'red' : '';
  return `
    <div class="card ${colorClass} ${extraClass}" data-card-id="${card.id}">
      <span class="rank-top">${rank}${suit}</span>
      <span class="suit-big">${suit}</span>
      <span class="rank-bottom">${rank}${suit}</span>
    </div>`;
}

/** Renders a face-down card back using the shared `.card-back` styles from table.css. */
export function cardBackHtml(extraClass = ''): string {
  return `<div class="card-back ${extraClass}"></div>`;
}
