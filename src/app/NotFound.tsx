import { Link } from 'react-router';
import FoodHeader from '../products/food/components/FoodHeader';
import FoodMark from '../products/food/components/FoodMark';
import '../products/food/food.css';

export function NotFound() {
  return (
    <div className="food-shell">
      <FoodHeader compact />
      <main id="main-content" className="food-state food-state--centered" tabIndex={-1}>
        <div className="food-state__symbol">
          <FoodMark />
        </div>
        <p className="food-kicker">Error 404</p>
        <h1>Esta página no está en la carta</h1>
        <p>La dirección que buscas no existe. El pedido de la semana está a un paso.</p>
        <div className="food-state__actions">
          <Link className="food-button" to="/">
            Ir a mi pedido
          </Link>
          <Link className="food-button food-button--quiet" to="/options">
            Explorar restaurantes
          </Link>
        </div>
      </main>
    </div>
  );
}
