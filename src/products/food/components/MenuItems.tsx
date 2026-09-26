import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { MAX_QUANTITY, formatEuros, isBeverage } from '../model/order';
import type { CartEntry, MenuItem } from '../model/types';

function MenuItemImage({
  item,
  className,
  onError,
}: {
  item: MenuItem;
  className: string;
  onError: () => void;
}) {
  return (
    <img
      className={`${className}${isBeverage(item.category) ? ' food-item-image--beverage' : ''}`}
      src={item.imageUrl ?? undefined}
      alt=""
      loading="lazy"
      onError={onError}
    />
  );
}

export function QuantityControl({
  item,
  quantity,
  onQuantity,
}: {
  item: MenuItem;
  quantity: number;
  onQuantity: (itemId: string, quantity: number) => void;
}) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="food-quantity" role="group" aria-label={`Cantidad de ${item.name}`}>
      {quantity > 0 && (
        <>
          <button
            type="button"
            onClick={() => {
              onQuantity(item.id, quantity - 1);
              if (quantity === 1) window.requestAnimationFrame(() => addButtonRef.current?.focus());
            }}
            aria-label={`Quitar una unidad de ${item.name}`}
          >
            −
          </button>
          <span key={quantity} className="food-quantity__value">
            {quantity}
          </span>
        </>
      )}
      <button
        ref={addButtonRef}
        className={quantity ? undefined : 'food-add-button'}
        type="button"
        onClick={() => onQuantity(item.id, quantity + 1)}
        disabled={quantity >= MAX_QUANTITY}
        aria-label={`Añadir una unidad de ${item.name}`}
      >
        {quantity ? '+' : 'Añadir +'}
      </button>
    </div>
  );
}

export function MenuItemCard({
  item,
  entry,
  onQuantity,
  onNote,
  onOpen,
}: {
  item: MenuItem;
  entry?: CartEntry;
  onQuantity?: (itemId: string, quantity: number) => void;
  onNote?: (itemId: string, note: string) => void;
  onOpen: (item: MenuItem, event: MouseEvent<HTMLElement>) => void;
}) {
  const quantity = entry?.quantity ?? 0;
  const [imageFailed, setImageFailed] = useState(false);
  const [noteInitiallyOpen] = useState(Boolean(entry?.note));
  const showImage = Boolean(item.imageUrl) && !isBeverage(item.category) && !imageFailed;
  return (
    <article
      className={`food-menu-card${showImage ? '' : ' food-menu-card--text'}${quantity ? ' food-menu-card--selected' : ''}`}
      aria-labelledby={`food-menu-item-${item.id}`}
    >
      {showImage && (
        <button
          className="food-menu-card__image-button"
          type="button"
          onClick={(event) => onOpen(item, event)}
          aria-label={`Ver foto y detalles de ${item.name}`}
        >
          <MenuItemImage
            item={item}
            className="food-menu-card__image"
            onError={() => setImageFailed(true)}
          />
        </button>
      )}
      <div className="food-menu-card__body">
        <div className="food-menu-card__heading">
          <h4 id={`food-menu-item-${item.id}`}>{item.name}</h4>
          <strong>{formatEuros(item.priceCents, item.currency)}</strong>
        </div>
        {item.description && <p className="food-menu-card__description">{item.description}</p>}
        <button
          id={`food-menu-details-${item.id}`}
          className="food-menu-card__details"
          type="button"
          aria-label={`Ver detalles de ${item.name}`}
          onClick={(event) => onOpen(item, event)}
        >
          Ver detalles
        </button>
        {onQuantity && <QuantityControl item={item} quantity={quantity} onQuantity={onQuantity} />}
        {quantity > 0 && onNote && (
          <details className="food-note-details" open={noteInitiallyOpen}>
            <summary>
              Nota para el plato <span className="sr-only">{item.name}</span>
            </summary>
            <label className="food-field food-field--item-note">
              <span>
                Nota para {item.name} <small>{entry?.note.length ?? 0}/240</small>
              </span>
              <input
                value={entry?.note ?? ''}
                maxLength={240}
                onChange={(event) => onNote(item.id, event.target.value)}
                placeholder="Sin cebolla, salsa aparte…"
              />
            </label>
          </details>
        )}
      </div>
    </article>
  );
}

export function ItemDetailModal({
  item,
  entry,
  onQuantity,
  onClose,
}: {
  item: MenuItem;
  entry?: CartEntry;
  onQuantity?: (itemId: string, quantity: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const quantity = entry?.quantity ?? 0;

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    closeButtonRef.current?.focus();
    return () => dialog.close();
  }, []);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="food-item-modal"
      aria-labelledby={`food-item-title-${item.id}`}
      aria-describedby={`food-item-description-${item.id}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section className="food-item-modal__panel">
        <button
          ref={closeButtonRef}
          className="food-item-modal__close"
          type="button"
          onClick={close}
          aria-label="Cerrar detalles"
        >
          <span aria-hidden="true">×</span>
        </button>
        {item.imageUrl && !imageFailed && (
          <div className="food-item-modal__media">
            <MenuItemImage
              item={item}
              className="food-item-modal__image"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="food-item-modal__content">
          <p className="food-menu-card__category">{item.category}</p>
          <h2 id={`food-item-title-${item.id}`}>{item.name}</h2>
          <strong className="food-item-modal__price">
            {formatEuros(item.priceCents, item.currency)}
          </strong>
          <p id={`food-item-description-${item.id}`} className="food-item-modal__description">
            {item.description || 'Este plato no tiene descripción disponible.'}
          </p>
          {onQuantity && (
            <div className="food-item-modal__actions">
              <span>{quantity ? `${quantity} en tu pedido` : 'Añádelo a tu pedido'}</span>
              <QuantityControl item={item} quantity={quantity} onQuantity={onQuantity} />
            </div>
          )}
        </div>
      </section>
    </dialog>
  );
}
