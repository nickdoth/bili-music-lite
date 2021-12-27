import React, { useEffect, useReducer, useState } from 'react';

import TextField from '@mui/material/TextField';
import { linkChangeState } from './util/mui';
import Button from '@mui/material/Button';
import { playMain, videoElm } from './effects/audio';
import produce from 'immer';
import { Avatar, IconButton, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import { bv2av, extractAvNumber, extractBv, isBv } from './util/av-bv';


const PLAYLIST_KEY = 'playlist';

interface PlayListItem {
  avId: string;
  name: string;
  pic: string;
}

interface AppState {
  selectedVid: string;
  playlist: PlayListItem[];
}

type AppAction = {
  type: 'remove' | 'select';
  payload: string;
} | {
  type: 'add',
  payload: { vid: string, name: string, pic: string },
}

const initAppState: AppState =  {
  playlist: JSON.parse(localStorage.getItem(PLAYLIST_KEY) ?? '[]'),
  selectedVid: 'na',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'add':
      return produce(state, draft => {
        draft.playlist = draft.playlist.filter(item => item.avId !== action.payload.vid);
        draft.playlist.push({ avId: action.payload.vid, name: action.payload.name, pic: action.payload.pic });
      });
    case 'remove':
      return produce(state, draft => {
        draft.playlist = draft.playlist.filter(item => item.avId !== action.payload);
      });
    case 'select':
      return produce(state, draft => {
        draft.selectedVid = action.payload;
      });
    default:
      return state;
  }
}

function App() {
  // App State //
  const [ state, dispatch ] = useReducer(appReducer, initAppState);


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
    
    if (vid) {
      dispatch({ type: 'select', payload: vid });
    }

    return playRes;
  };

  const pushLocalStorage = (state: AppState) => {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(state.playlist));
  }

  const doAdd = async () => {
    const playRes = await play(vidInput);
    if (!playRes) {
      alert('Failed to add ' + vidInput);
      return;
    }
    const addAction: AppAction = { type: 'add', payload: { vid: playRes.vid, name: playRes.title, pic: playRes.pic } };

    pushLocalStorage(appReducer(state, addAction));

    dispatch(addAction);
  }

  const createDoSelect = (avId: string) => () => {
    play(avId);
  }

  const createDoDelete = (avId: string) => () => {
    const deleteAction: AppAction = { type: 'remove', payload: avId }

    pushLocalStorage(appReducer(state, deleteAction));
    
    dispatch(deleteAction);
  }

  useEffect(() => {
    const listener = () => {
      const currentIdx = state.playlist.findIndex(item => item.avId === state.selectedVid);
      if (currentIdx == state.playlist.length - 1) {
        if (state.playlist.length > 0) {
          play(state.playlist[0].avId);
        }
      } else {
        play(state.playlist[currentIdx + 1].avId);
      }
    };
    videoElm.addEventListener('ended', listener);

    return () => {
      videoElm.removeEventListener('ended', listener);
    }
  }, [ state.selectedVid ]);

  // Intermediate States //
  const [ vidInput, setVid ] = useState('');

  return (
    <div className="App">
      <TextField
        onChange={linkChangeState(setVid)}
        value={vidInput}
        label={'Search by Av/Bv'}
      />

      <Button onClick={doAdd}>Play Music</Button>

      <List>
        {state.playlist.map(item => <ListItem key={item.avId} onClick={state.selectedVid === item.avId ? undefined : createDoSelect(item.avId)}
          secondaryAction={
            <IconButton edge="end" aria-label="delete" onClick={(ev) => {
              ev.stopPropagation();
              createDoDelete(item.avId)();
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
        </ListItem>)}
      </List>
    </div>
  );
}

export default App;
