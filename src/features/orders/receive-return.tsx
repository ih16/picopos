import { component$, useSignal } from '@builder.io/qwik';
import { RETURN_CONDITIONS } from '../../domain/workbook';
import { Button, SelectField } from '../../shared/ui/controls';

import type { OrdersProps } from './order-types';
import type { ReturnCondition, Return as ReturnEntry } from '../../domain/workbook';
export const ReceiveReturn = component$<Pick<OrdersProps, 'busy' | 'onCommit$'> & { entry: ReturnEntry }>(
  ({ entry, busy, onCommit$ }) => {
    const condition = useSignal<ReturnCondition>(RETURN_CONDITIONS[0]);
    return (
      <form
        class="row"
        preventdefault:submit
        onSubmit$={async (_, form) => {
          const condition = new FormData(form).get('condition') as ReturnCondition;
          await onCommit$(
            [
              {
                tab: 'Returns',
                row: { ...entry, status: 'Received', condition, receivedAt: new Date().toISOString() },
              },
            ],
            [{ tab: 'Returns', row: entry }],
          );
        }}
      >
        <SelectField
          name="condition"
          label="Condition of returned item"
          value={condition.value}
          disabled={busy}
          options={RETURN_CONDITIONS.map((value) => ({ value, label: value }))}
          onChange$={(value) => {
            condition.value = value as ReturnCondition;
          }}
        />
        <Button class="secondary" type="submit" disabled={busy}>
          Receive
        </Button>
      </form>
    );
  },
);
