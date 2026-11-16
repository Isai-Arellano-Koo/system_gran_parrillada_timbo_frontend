import {
  KITCHEN_TONES,
  ORDER_TONES,
  type OrderTone,
} from "../helpers/orderStatus";

type Props = {
  variant?: "salon" | "kitchen" | "delivery";
};

const SALON: OrderTone[] = [
  "free",
  "editing",
  "kitchen",
  "cooking",
  "ready",
  "dining",
];

export function StatusLegend({ variant = "salon" }: Props) {
  const items =
    variant === "kitchen"
      ? KITCHEN_TONES
      : ORDER_TONES.filter((item) =>
          variant === "delivery"
            ? item.tone !== "free"
            : SALON.includes(item.tone)
        );

  return (
    <ul className="status-legend" aria-label="Colores de estado">
      {items.map((item) => (
        <li key={item.tone} className={`st st-${item.tone}`}>
          <i aria-hidden="true" />
          {item.label}
        </li>
      ))}
      {variant === "salon" ? (
        <li className="st st-unpaid">
          <i aria-hidden="true" />
          Sin pagar
        </li>
      ) : null}
    </ul>
  );
}
