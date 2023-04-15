/* eslint-disable @typescript-eslint/ban-types */
import * as React from 'react';
import { ReactOpenTracesWidget } from 'traceviewer-react-components/lib/trace-explorer/trace-explorer-opened-traces-widget';
import { VsCodeMessageManager } from '../../common/vscode-message-manager';
import { Menu, Item, useContextMenu, ItemParams } from 'react-contexify';
import { TspClientProvider } from '../../common/tsp-client-provider-impl';
import { ITspClientProvider } from 'traceviewer-base/lib/tsp-client-provider';
import { Experiment } from 'tsp-typescript-client/lib/models/experiment';
import { signalManager, Signals } from 'traceviewer-base/lib/signals/signal-manager';
import '../../style/trace-viewer.css';
import 'traceviewer-react-components/style/trace-explorer.css';
import '../../style/react-contextify.css';
import { ExperimentManager } from 'traceviewer-base/lib/experiment-manager';
import { convertSignalExperiment } from 'vscode-trace-webviews/src/common/vscode-signal-converter';
import JSONBigConfig from 'json-bigint';
import { OpenedTracesUpdatedSignalPayload } from 'traceviewer-base/lib/signals/opened-traces-updated-signal-payload';
import { ReactExplorerPlaceholderWidget } from 'traceviewer-react-components/lib/trace-explorer/trace-explorer-placeholder-widget';
const JSONBig = JSONBigConfig({
    useNativeBigInt: true,
});

interface OpenedTracesAppState {
  tspClientProvider: ITspClientProvider | undefined;
  experimentsOpened: boolean;
  loading: boolean;
}

const MENU_ID = 'traceExplorer.openedTraces.menuId';

class TraceExplorerOpenedTraces extends React.Component<{}, OpenedTracesAppState>  {
  private _signalHandler: VsCodeMessageManager;
  private _experimentManager: ExperimentManager;

  static ID = 'trace-explorer-opened-traces-widget';
  static LABEL = 'Opened Traces';

  private _onExperimentSelected = (openedExperiment: Experiment | undefined): void => this.doHandleExperimentSelectedSignal(openedExperiment);
  private _onExperimentDeleted = (deletedExperiment: Experiment): void => this.doHandleExperimentDeletedSignal(deletedExperiment);
  protected onUpdateSignal = (payload: OpenedTracesUpdatedSignalPayload): void => this.doHandleOpenedTracesChanged(payload);

  constructor(props: {}) {
      super(props);
      this.state = {
          tspClientProvider: undefined,
          experimentsOpened: true,
          loading: false
      };
      this._signalHandler = new VsCodeMessageManager();
      window.addEventListener('message', event => {

          const message = event.data; // The JSON data our extension sent
          switch (message.command) {
          case 'set-tspClient':
              const tspClientProvider: ITspClientProvider = new TspClientProvider(message.data);
              this._experimentManager = tspClientProvider.getExperimentManager();
              this.setState({ tspClientProvider: tspClientProvider });
              if (this.state.tspClientProvider) {
                  this.state.tspClientProvider.addTspClientChangeListener(() => {
                      if (this.state.tspClientProvider) {
                          this._experimentManager = this.state.tspClientProvider.getExperimentManager();
                      }
                  });
              }
              break;
          case 'traceViewerTabActivated':
              if (message.data) {
                  const experiment = convertSignalExperiment(JSONBig.parse(message.data));
                  signalManager().fireTraceViewerTabActivatedSignal(experiment);
              }
              break;
          case 'openedTracesUpdated':
              if (message.numberOfOpenedTraces) {
              // TODO: Render a "Open Trace" button if numberOfOpenedTraces is 0
              }
              break;
          case 'experimentOpened':
              console.log('opened-traces-widget experimentOpened message recieved');
              if (message.data) {
                  const experiment = convertSignalExperiment(JSONBig.parse(message.data));
                  signalManager().fireExperimentOpenedSignal(experiment);
                  if (!this.state.experimentsOpened) {
                      console.log('opened-traces-widget experimentOpened setState');
                      this.setState({experimentsOpened: true});
                  }
              }
          }
      });
      // this.onOutputRemoved = this.onOutputRemoved.bind(this);
      signalManager().on(Signals.EXPERIMENT_SELECTED, this._onExperimentSelected);
      signalManager().on(Signals.OPENED_TRACES_UPDATED, this.onUpdateSignal);
      signalManager().on(Signals.EXPERIMENT_DELETED, this._onExperimentDeleted);
  }

  componentDidMount(): void {
      this._signalHandler.notifyReady();
  }

  componentWillUnmount(): void {
      signalManager().off(Signals.EXPERIMENT_SELECTED, this._onExperimentSelected);
      signalManager().off(Signals.OPENED_TRACES_UPDATED, this.onUpdateSignal);
      signalManager().off(Signals.EXPERIMENT_DELETED, () => console.log('vscode-trace-explorer-opened-traces-widget EXP_DELETED'));
  }

  protected doHandleOpenedTracesChanged(payload: OpenedTracesUpdatedSignalPayload): void {
      console.log('doHandleOpenedTracesChanged: '+payload.getNumberOfOpenedTraces());
      this._signalHandler.updateOpenedTraces(payload.getNumberOfOpenedTraces());
      if (!this.state.experimentsOpened && payload.getNumberOfOpenedTraces()>0) {
          console.log('doHandleOpenedTracesChanged setState');
          this.setState({experimentsOpened: true});
      } else if (this.state.experimentsOpened && payload.getNumberOfOpenedTraces()===0){
          console.log('doHandleOpenedTracesChanged setState');
          this.setState({experimentsOpened: false});
      }
  }

  protected doHandleContextMenuEvent(event: React.MouseEvent<HTMLDivElement>, experiment: Experiment): void {
      const { show } = useContextMenu({
          id: MENU_ID,
      });

      show(event, {
          props: {
              experiment: experiment,
          }
      });
  }

  protected doHandleClickEvent(event: React.MouseEvent<HTMLDivElement>, experiment: Experiment): void {
      this._signalHandler.reOpenTrace(experiment);
  }

  protected doHandleExperimentSelectedSignal(experiment: Experiment | undefined): void {
      console.log('opened-traces-widget doHandleExperimentSelectedSignal');
      this._signalHandler.experimentSelected(experiment);
  }

  protected doHandleExperimentDeletedSignal(experiment: Experiment): void {
      console.log('opened-traces-widget doHandleExperimentDeletedSignal');
      console.log(experiment.name);
      //   this._signalHandler.deleteTrace(experiment);
  }

  public render(): React.ReactNode {
      return ( this.state.experimentsOpened ? <><div>
          {this.state.tspClientProvider && <ReactOpenTracesWidget
              id={TraceExplorerOpenedTraces.ID}
              title={TraceExplorerOpenedTraces.LABEL}
              tspClientProvider={this.state.tspClientProvider}
              contextMenuRenderer={(event: React.MouseEvent<HTMLDivElement, MouseEvent>, experiment: Experiment) => this.doHandleContextMenuEvent(event, experiment)}
              onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>, experiment: Experiment) => this.doHandleClickEvent(event, experiment) }
          ></ReactOpenTracesWidget>
          }
      </div>
      <Menu id={MENU_ID} theme={'dark'} animation={'fade'}>
          <Item id="open-id" onClick={this.handleItemClick}>Open Trace</Item>
          <Item id="close-id" onClick={this.handleItemClick}>Close Trace</Item>
          <Item id="remove-id" onClick={this.handleItemClick}>Remove Trace</Item>
      </Menu>
      </> :
          <ReactExplorerPlaceholderWidget
              loading={this.state.loading}
              handleOpenTrace={this.handleOpenTrace}
          ></ReactExplorerPlaceholderWidget>
      );
  }

  protected handleOpenTrace = async (): Promise<void> => this.doHandleOpenTrace();

  private async doHandleOpenTrace() {
      this.setState({loading: true});
      console.log('openTrace clicked in placeholder view');
      this._signalHandler.openTrace();
      this.setState({loading: false});
  }

  protected handleItemClick = (args: ItemParams): void => {
      switch (args.event.currentTarget.id) {
      case 'open-id':
          this._signalHandler.reOpenTrace(args.props.experiment as Experiment);
          return;
      case 'close-id':
          this._signalHandler.closeTrace(args.props.experiment as Experiment);
          return;
      case 'remove-id':
          this._signalHandler.deleteTrace(args.props.experiment as Experiment);
          if (this._experimentManager) {
              this._experimentManager.deleteExperiment((args.props.experiment as Experiment).UUID);
          }

          return;
      default:
        // Do nothing
      }
  };
}

export default TraceExplorerOpenedTraces;
