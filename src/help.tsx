import { render } from '@solidjs/web';

import { initializeShell } from './app/shell';
import { Help } from './features/help/help';

initializeShell();
render(() => <Help />, document.getElementById('app')!);
