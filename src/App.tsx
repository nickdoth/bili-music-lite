import { useState } from 'react';

import TextField from '@mui/material/TextField';
import { linkChangeState } from './util/mui';
import Button from '@mui/material/Button';
import produce from 'immer';
import { Avatar, IconButton, List, ListItem, ListItemAvatar, ListItemText, ToggleButton, ToggleButtonGroup } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { bv2av, extractAvNumber, extractBv, isBv } from './util/av-bv';
import { useDispatch, useSelector } from 'react-redux';
import { Cmd, Loop, loop, WithDefaultActionHandling } from 'redux-loop';
import { Dispatch } from 'redux';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';

import { useEffect } from 'react';


const PLAYLIST_KEY = 'playlist';
const LOOP_MODE_KEY = 'loopMode';

// State //

type LoopMode = 'LIST' | 'SINGLE' | 'NONE';

interface PlayListItem {
  avId: string;
  name: string;
  pic: string;
}

interface AppState {
  selectedVid: string;
  playlist: PlayListItem[];
  loopMode: LoopMode;
}

const initAppState: AppState =  {
  playlist: JSON.parse(localStorage.getItem(PLAYLIST_KEY) ?? '[]'),
  selectedVid: 'na',
  loopMode: localStorage.getItem(LOOP_MODE_KEY) as LoopMode || 'LIST',
};

// Actions //

function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

export type AppAction = WithDefaultActionHandling<{
  type: 'remove' | 'select' | 'doAdd' | 'doSelect';
  payload: string;
} |
{
  type: 'add',
  payload: { vid: string, name: string, pic: string },
} |
{
  type: 'updateLoopMode',
  payload: LoopMode,
} | 
{
  type: 'reorder',
  payload: [ number, number ],
} |
{
  type: 'initPlayer',
  payload: string,
}
>;

const actions = {
  doSelect: (vid: string) => ({ type: 'doSelect' as const, payload: vid }),
  // add: (vid: string) => ({ type: 'add' as const, payload: vid }),
  remove: (vid: string) => ({ type: 'remove' as const, payload: vid }),
  doAdd: (vid: string) => ({ type: 'doAdd' as const, payload: vid }),
  updateLoopMode: (loopMode: LoopMode) => ({ type: 'updateLoopMode' as const, payload: loopMode }),
  reorder: (startIndex: number, endIndex: number) => ({ type: 'reorder' as const, payload: [startIndex, endIndex] }),
  initPlayer: (elemId: string) => ({ type: 'initPlayer' as const, payload: elemId }),
};


// Side Effects //
const pushLocalStorage = (state: AppState) => {
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(state.playlist));
  localStorage.setItem(LOOP_MODE_KEY, state.loopMode);
}

const playerController = (() => {
  let listener: (() => void) | null = null;
  let mediaElm: HTMLAudioElement | null = null;

  const SERVER = 'https://bili-music.hk.cn2.nickdoth.cc';

  async function playMain(avid: string) {
    let res = await fetch(`${SERVER}/playurl/av${avid}`).then(res => res.json());
    const { aurl } = res;
    mediaElm!.src = aurl;

    return res;
  }

  const play = async (_vidInput: string) => {
    
    console.log(extractAvNumber(_vidInput));
    const avNumber = extractAvNumber(_vidInput);
    let playRes: any;
    if (avNumber) {
      playRes = await playMain(avNumber);
    } else if (isBv(_vidInput)) {
      playRes = await playMain(extractAvNumber(bv2av(extractBv(_vidInput)!))!);
    }
  
    const vid = playRes.bvid || playRes.avid;
    playRes.vid = vid;
  
    window.document.title = `${playRes.title} - BILI MUSIC`
  
    return playRes;
  };

  return {
    play,
    initPlayer: (elemId: string) => {
      mediaElm = document.getElementById(elemId) as HTMLAudioElement;
    },
    updateState: (state: AppState, dispatch: Dispatch) => {
      if (listener) {
        mediaElm?.removeEventListener('ended', listener);
      }
      listener = () => {
        const currentIdx = state.playlist.findIndex(item => item.avId === state.selectedVid);
        switch (state.loopMode) {
          case 'LIST':
            if (currentIdx === state.playlist.length - 1) {
              if (state.playlist.length > 0) {
                dispatch(actions.doSelect(state.playlist[0].avId));
              }
            } else {
              dispatch(actions.doSelect(state.playlist[currentIdx + 1].avId));
            }
            break;
          case 'SINGLE':
            dispatch(actions.doSelect(state.playlist[currentIdx].avId));
            break;
          case 'NONE':
            break;
        }
      };
      mediaElm?.addEventListener('ended', listener);
    },
  }
})();

export function appReducer(state: AppState = initAppState, action: AppAction): AppState | Loop<AppState> {
  switch (action.type) {
    case 'add':
      const nextStateAfterAdd = produce(state, draft => {
        draft.playlist = draft.playlist.filter(item => item.avId !== action.payload.vid);
        draft.playlist.push({ avId: action.payload.vid, name: action.payload.name, pic: action.payload.pic });
      });

      return loop(
        nextStateAfterAdd,
        Cmd.list([
          Cmd.run(pushLocalStorage, { args: [nextStateAfterAdd] }),
          Cmd.action({ type: 'select', payload: action.payload.vid }),
        ]),
      );
    case 'remove':
      const nextStateAfterRemove = produce(state, draft => {
        draft.playlist = draft.playlist.filter(item => item.avId !== action.payload);
      });

      return loop(
        nextStateAfterRemove,
        Cmd.run(pushLocalStorage, { args: [nextStateAfterRemove] }),
      );
    case 'updateLoopMode':
      const nextStateAfterUpdateLoopMode = produce(state, draft => {
        draft.loopMode = action.payload;
      });
      return loop(
        nextStateAfterUpdateLoopMode,
        Cmd.list([
          Cmd.run(playerController.updateState, { args: [nextStateAfterUpdateLoopMode, Cmd.dispatch as any] }),
          Cmd.run(pushLocalStorage, { args: [nextStateAfterUpdateLoopMode] }),
        ]),
      );
    case 'reorder':
      const nextStateAfterReorder = produce(state, draft => {
        draft.playlist = reorder(draft.playlist, action.payload[0], action.payload[1]);
      });

      return loop(
        nextStateAfterReorder,
        Cmd.list([
          Cmd.run(playerController.updateState, { args: [nextStateAfterReorder, Cmd.dispatch as any] }),
          Cmd.run(pushLocalStorage, { args: [nextStateAfterReorder] }),
        ]),
      );
    case 'select':
      const nextStateAfterSelect = produce(state, draft => {
        draft.selectedVid = action.payload;
      });
      return loop(
        nextStateAfterSelect,
        Cmd.run(playerController.updateState, { args: [nextStateAfterSelect, Cmd.dispatch as any] })
      );
    case 'doSelect':
      return loop(
        state,
        Cmd.list([
          Cmd.run(playerController.play, { args: [action.payload] }),
          Cmd.action({ type: 'select', payload: action.payload }),
        ]),
      );
    case 'doAdd':
      return loop(
        state,
        Cmd.run(playerController.play, {
          args: [action.payload],
          successActionCreator: (playRes: any) => ({
            type: 'add', 
            payload: { vid: playRes.vid, name: playRes.title, pic: playRes.pic },
          })
        })
      );
    case 'initPlayer':
      return loop(
        state,
        Cmd.list([
          Cmd.run(playerController.initPlayer, { args: [action.payload] }),
          Cmd.run(playerController.updateState, { args: [state, Cmd.dispatch as any] }),
        ], { sequence: true }),
      )
    default:
      return state;
  }
}

function App() {
  // App State //
  const state = useSelector(state => state.app);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(actions.initPlayer('meida-elm'));
  }, [ dispatch ]);

  // Intermediate States //
  const [ vidInput, setVid ] = useState('');

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    dispatch(actions.reorder(result.source.index, result.destination.index));
  }

  return (
    <div style={styles.App}>
      <div style={styles.Playlist}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="playlist">
            {(provided, snapshot) => <List {...provided.droppableProps} ref={provided.innerRef} style={{ ...styles.PlaylistInner }}>
              {state.playlist.map((item, index) => <Draggable index={index} draggableId={item.avId} key={item.avId}>
                  {(provided, snapshot) => <ListItem
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{ ...provided.draggableProps.style, width: '100%' }}
                    ref={provided.innerRef}
                    onClick={state.selectedVid === item.avId ? undefined : () => dispatch(actions.doSelect(item.avId))}
                    secondaryAction={
                      <IconButton edge="end" aria-label="delete" onClick={(ev) => {
                        ev.stopPropagation();
                        dispatch(actions.remove(item.avId));
                      }}>
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar alt="B"
                        // src={item.pic}
                      />
                    </ListItemAvatar>

                    <ListItemText primary={<span style={{ fontWeight: state.selectedVid !== item.avId ? undefined : 'bold' }}>{item.name}</span>} secondary={item.avId} />
                  </ListItem>}
              </Draggable>)}

            </List>}
          </Droppable>
        </DragDropContext>
      </div>

      <div style={styles.Controls}>

        <div style={styles.ControlRow}>
          <TextField
            onChange={linkChangeState(setVid)}
            value={vidInput}
            label={'Av/Bv ID'}
            variant="filled"
            fullWidth
          />

          <Button onClick={() => dispatch(actions.doAdd(vidInput))}>Add</Button>
        </div>

        <div style={styles.ControlRow}>
          <ToggleButtonGroup exclusive value={state.loopMode} onChange={(_ev, newVal) => dispatch(actions.updateLoopMode(newVal))}>
            <ToggleButton value="LIST">List</ToggleButton>
            <ToggleButton value="SINGLE">Single</ToggleButton>
            <ToggleButton value="NONE">None</ToggleButton>
          </ToggleButtonGroup>

          <audio id="meida-elm" controls autoPlay />
        </div>
      </div>
      
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  App: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    flexDirection: 'column',
  },
  Controls: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',

    position: 'sticky',
    bottom: 0,
  
    background: '#fdfdfd',
    zIndex: 10,
  },

  Playlist: {
    position: 'relative',
    overflow: 'auto',
    flexGrow: 1,
    width: '100%',
  },

  PlaylistInner: {
    position: 'absolute',
    width: '100%',
  },

  ControlRow: { display: 'flex', justifyContent: 'center' },
}

export default App;
