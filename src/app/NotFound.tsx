import { Link } from 'react-router';
import '../products/food/food.css';

export function NotFound() {
  return (
    <main id="main-content" className="food-state food-state--centered" tabIndex={-1}>
      <p className="food-kicker">Error 404</p>
      <h1>Esta página no existe</h1>
      <p>Vuelve al pedido semanal o consulta los restaurantes disponibles.</p>
      <p>
        <Link className="food-button" to="/">
          Volver a MenuBox
        </Link>
      </p>
    </main>
  );
}
