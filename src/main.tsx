import { render } from '@solidjs/web';

import { initializeShell } from './app/shell';
import Workspace from './app/workspace';

initializeShell();
render(() => <Workspace />, document.getElementById('app')!);
