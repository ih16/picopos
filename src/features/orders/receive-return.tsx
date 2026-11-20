import { createSignal } from 'solid-js';

import type { ReturnCondition, Return as ReturnEntry } from '../../domain/workbook';
import { RETURN_CONDITIONS } from '../../domain/workbook';
import { Button, SelectField } from '../../shared/ui/controls';
import type { OrdersProps } from './order-types';

type ReceiveReturnProps = Pick<OrdersProps, 'busy' | 'onCommit'> & { entry: ReturnEntry };

export function ReceiveReturn(props: ReceiveReturnProps) {
  const [condition, setCondition] = createSignal<ReturnCondition>(RETURN_CONDITIONS[0]);
  return (
    <form
      class="row"
      onSubmit={async (event) => {
        event.preventDefault();
        await props.onCommit(
          [
            {
              tab: 'Returns',
              row: {
                ...props.entry,
                status: 'Received',
                condition: condition(),
                receivedAt: new Date().toISOString(),
              },
            },
          ],
          [{ tab: 'Returns', row: props.entry }],
        );
      }}
    >
      <SelectField
        name="condition"
        label="Condition of returned item"
        value={condition()}
        disabled={props.busy}
        options={RETURN_CONDITIONS.map((value) => ({ value, label: value }))}
        onChange={(value) => {
          setCondition(value as ReturnCondition);
        }}
      />
      <Button class="secondary" type="submit" disabled={props.busy}>
        Receive
      </Button>
    </form>
  );
}
