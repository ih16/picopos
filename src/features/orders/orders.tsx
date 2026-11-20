import { createMemo, Show, useContext } from 'solid-js';

import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { Panel } from '../../shared/ui/controls';
import { CreateOrder } from './create-order';
import { OrderDetail } from './order-detail';
import { OrderList } from './order-list';
import type { OrdersProps } from './order-types';

export function Orders(props: OrdersProps) {
  const { route } = useContext(ScreenNavigation);
  const selected = createMemo(() => props.data.Orders.find((order) => order.id === route().orderId));
  return (
    <>
      {route().creating ? (
        <CreateOrder {...props} />
      ) : route().orderId ? (
        <Show
          when={selected()}
          fallback={
            <div class="stack record-page">
              <div class="order-header">
                <h1>Order not found</h1>
              </div>
              <Panel>
                <p>This order is not available in the connected workbook.</p>
              </Panel>
            </div>
          }
        >
          {(order) => <OrderDetail {...props} order={order()} />}
        </Show>
      ) : (
        <OrderList {...props} />
      )}
    </>
  );
}
