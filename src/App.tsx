import { useState } from 'react';

import TextField from '@mui/material/TextField';
import { linkChangeState } from './util/mui';
import Button from '@mui/material/Button';
import { playMain, videoElm } from './effects/audio';
import produce from 'immer';
import { Avatar, IconButton, List, ListItem, ListItemAvatar, ListItemText, ToggleButton, ToggleButtonGroup } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { bv2av, extractAvNumber, extractBv, isBv } from './util/av-bv';
import { useDispatch, useSelector } from 'react-redux';
import { Cmd, Loop, loop, WithDefaultActionHandling } from 'redux-loop';
import { Dispatch } from 'redux';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';


const PLAYLIST_KEY = 'playlist';

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
  loopMode: 'LIST',
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
}
>;

const actions = {
  doSelect: (vid: string) => ({ type: 'doSelect' as const, payload: vid }),
  // add: (vid: string) => ({ type: 'add' as const, payload: vid }),
  remove: (vid: string) => ({ type: 'remove' as const, payload: vid }),
  doAdd: (vid: string) => ({ type: 'doAdd' as const, payload: vid }),
  updateLoopMode: (loopMode: LoopMode) => ({ type: 'updateLoopMode' as const, payload: loopMode }),
  reorder: (startIndex: number, endIndex: number) => ({ type: 'reorder', payload: [startIndex, endIndex] }),
};


// Side Effects //
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

const pushLocalStorage = (state: AppState) => {
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(state.playlist));
}

const playlistControl = (() => {
  let listener: (() => void) | null = null;

  return {
    update: (state: AppState, dispatch: Dispatch) => {
      if (listener) {
        videoElm.removeEventListener('ended', listener);
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
      videoElm.addEventListener('ended', listener);
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
        Cmd.run(playlistControl.update, { args: [nextStateAfterUpdateLoopMode, Cmd.dispatch as any] })
      );
    case 'reorder':
      const nextStateAfterReorder = produce(state, draft => {
        draft.playlist = reorder(draft.playlist, action.payload[0], action.payload[1]);
      });

      return loop(
        nextStateAfterReorder,
        Cmd.list([
          Cmd.run(playlistControl.update, { args: [nextStateAfterReorder, Cmd.dispatch as any] }),
          Cmd.run(pushLocalStorage, { args: [nextStateAfterReorder] }),
        ]),
      );
    case 'select':
      const nextStateAfterSelect = produce(state, draft => {
        draft.selectedVid = action.payload;
      });
      return loop(
        nextStateAfterSelect,
        Cmd.run(playlistControl.update, { args: [nextStateAfterSelect, Cmd.dispatch as any] })
      );
    case 'doSelect':
      return loop(
        state,
        Cmd.list([
          Cmd.run(play, { args: [action.payload] }),
          Cmd.action({ type: 'select', payload: action.payload }),
        ]),
      );
    case 'doAdd':
      return loop(
        state,
        Cmd.run(play, {
          args: [action.payload],
          successActionCreator: (playRes: any) => ({
            type: 'add', 
            payload: { vid: playRes.vid, name: playRes.title, pic: playRes.pic },
          })
        })
      );
    default:
      return state;
  }
}

function App() {
  // App State //
  const state = useSelector(state => state.app);
  const dispatch = useDispatch();

  // Intermediate States //
  const [ vidInput, setVid ] = useState('');

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    dispatch(actions.reorder(result.source.index, result.destination.index));
  }

  return (
    <div className="App">
      <TextField
        onChange={linkChangeState(setVid)}
        value={vidInput}
        label={'Search by Av/Bv'}
      />

      <Button onClick={() => dispatch(actions.doAdd(vidInput))}>Play Music</Button>

      <ToggleButtonGroup exclusive value={state.loopMode} onChange={(_ev, newVal) => dispatch(actions.updateLoopMode(newVal))}>
        <ToggleButton value="LIST">List</ToggleButton>
        <ToggleButton value="SINGLE">Single</ToggleButton>
        <ToggleButton value="NONE">None</ToggleButton>
      </ToggleButtonGroup>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="playlist">
          {(provided, snapshot) => <List {...provided.droppableProps} ref={provided.innerRef}>
            {state.playlist.map((item, index) => <Draggable index={index} draggableId={item.avId} key={item.avId}>
                {(provided, snapshot) => <ListItem
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
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
  );
}

export default App;
