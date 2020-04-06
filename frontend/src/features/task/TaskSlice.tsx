import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { TasksByColumn, ITask, Id, NewTask } from "types";
import { fetchBoardById } from "features/board/BoardSlice";
import { AppDispatch, AppThunk, RootState } from "store";
import {
  createErrorToast,
  createSuccessToast,
  createInfoToast
} from "features/toast/ToastSlice";
import api, { API_SORT_TASKS, API_TASKS } from "api";

type TasksById = Record<string, ITask>;

interface InitialState {
  byColumn: TasksByColumn;
  byId: TasksById;
  createLoading: boolean;
  dialogOpen: boolean;
  dialogColumn: Id | null;
}

export const initialState: InitialState = {
  byColumn: {},
  byId: {},
  createLoading: false,
  dialogOpen: false,
  dialogColumn: null
};

export const updateTaskTitle = createAsyncThunk<
  ITask,
  { id: Id; title: string }
>("task/updateTaskTitleStatus", async ({ id, title }) => {
  const response = await api.patch(`${API_TASKS}${id}/`, { title });
  return response.data;
});

export const createTask = createAsyncThunk<
  ITask,
  NewTask,
  {
    rejectValue: string;
  }
>("task/createTaskStatus", async (task, { dispatch, rejectWithValue }) => {
  try {
    const response = await api.post(`${API_TASKS}`, task);
    dispatch(createSuccessToast("Task created"));
    return response.data;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const deleteTask = createAsyncThunk<Id, Id>(
  "task/deleteTaskStatus",
  async (id, { dispatch }) => {
    await api.delete(`${API_TASKS}${id}/`);
    dispatch(createInfoToast("Task deleted"));
    return id;
  }
);

export const slice = createSlice({
  name: "task",
  initialState,
  reducers: {
    setTasksByColumn: (state, action: PayloadAction<TasksByColumn>) => {
      state.byColumn = action.payload;
    },
    setDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.dialogOpen = action.payload;
    },
    setDialogColumn: (state, action: PayloadAction<Id>) => {
      state.dialogColumn = action.payload;
    }
  },
  extraReducers: builder => {
    builder.addCase(fetchBoardById.fulfilled, (state, action) => {
      const byColumn: TasksByColumn = {};
      const byId: TasksById = {};
      for (const col of action.payload.columns) {
        for (const task of col.tasks) {
          byId[task.id] = task;
        }
        byColumn[col.id] = col.tasks.map(t => t.id);
      }
      state.byColumn = byColumn;
      state.byId = byId;
    });
    builder.addCase(updateTaskTitle.fulfilled, (state, action) => {
      state.byId[action.payload.id] = action.payload;
    });
    builder.addCase(createTask.pending, state => {
      state.createLoading = true;
    });
    builder.addCase(createTask.fulfilled, (state, action) => {
      state.byId[action.payload.id] = action.payload;
      state.byColumn[action.payload.column].push(action.payload.id);
      state.dialogOpen = false;
      state.createLoading = false;
    });
    builder.addCase(createTask.rejected, state => {
      state.createLoading = false;
    });
    builder.addCase(deleteTask.fulfilled, (state, action) => {
      for (const [column, tasks] of Object.entries(state.byColumn)) {
        for (let i = 0; i < tasks.length; i++) {
          if (tasks[i] === action.payload) {
            state.byColumn[column].splice(i, 1);
          }
        }
      }
      delete state.byId[action.payload];
    });
  }
});

export const {
  setTasksByColumn,
  setDialogOpen,
  setDialogColumn
} = slice.actions;

export const updateTasksByColumn = (
  tasksByColumn: TasksByColumn
): AppThunk => async (dispatch: AppDispatch, getState: () => RootState) => {
  const state = getState();
  const previousTasksByColumn = state.task.byColumn;
  const boardId = state.board.detail?.id;
  try {
    dispatch(setTasksByColumn(tasksByColumn));
    await api.post(API_SORT_TASKS, {
      board: boardId,
      tasks: tasksByColumn,
      order: Object.values(tasksByColumn).flat()
    });
    dispatch(createSuccessToast("Tasks ordered"));
  } catch (err) {
    dispatch(setTasksByColumn(previousTasksByColumn));
    dispatch(createErrorToast(err.toString()));
  }
};

export default slice.reducer;
