import { NavLink } from 'react-router';
import FoodMark from './FoodMark';

export default function FoodHeader({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <a
        className="food-skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Saltar al contenido principal
      </a>
      <header className={`food-header${compact ? ' food-header--compact' : ''}`}>
        <NavLink className="food-brand" to="/" end aria-label="MenuBox, inicio">
          <span className="food-brand__mark" aria-hidden="true">
            <FoodMark />
          </span>
          <span>
            <strong>MenuBox</strong>
            <small>La mesa del equipo</small>
          </span>
        </NavLink>
        <nav className="food-header__nav" aria-label="Navegación de MenuBox">
          <NavLink to="/" end>
            Mi pedido
          </NavLink>
          <NavLink to="/options">Restaurantes</NavLink>
          <NavLink to="/roulette">Ruleta</NavLink>
        </nav>
        <NavLink className="food-header__admin" to="/admin">
          Administración
        </NavLink>
      </header>
    </>
  );
}
