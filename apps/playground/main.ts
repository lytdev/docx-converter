import './styles.css';
import { PlaygroundController } from './controller';
import { PlaygroundView } from './ui/view';
import { ConversionWorkerClient } from './worker/client';

new PlaygroundController(new PlaygroundView(), new ConversionWorkerClient()).start();
