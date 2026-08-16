import { NavLink } from 'react-router';

export default function FoodHeader({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <a className="food-skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <header className={`food-header${compact ? ' food-header--compact' : ''}`}>
        <NavLink className="food-brand" to="/" end aria-label="MenuBox, inicio">
          <span className="food-brand__mark" aria-hidden="true">
            M
          </span>
          <span>
            <strong>MenuBox</strong>
            <small>El pedido de la semana</small>
          </span>
        </NavLink>
        <nav className="food-header__nav" aria-label="Navegación de MenuBox">
          <NavLink to="/options">Restaurantes</NavLink>
          <NavLink to="/admin">Administración</NavLink>
        </nav>
      </header>
    </>
  );
}
