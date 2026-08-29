jest.mock('@react-native-documents/picker',()=>({pick:jest.fn(),keepLocalCopy:jest.fn()}));
import{keepLocalCopy,pick}from'@react-native-documents/picker';
import{pickReaderBackground}from'../src/core/readerBackground';
test('copies a selected reader background into the app document directory',async()=>{(pick as jest.Mock).mockResolvedValue([{uri:'content://image',name:'paper.jpg'}]);(keepLocalCopy as jest.Mock).mockResolvedValue([{status:'success',localUri:'file:///docs/paper.jpg'}]);await expect(pickReaderBackground()).resolves.toBe('file:///docs/paper.jpg');expect(keepLocalCopy).toHaveBeenCalledWith(expect.objectContaining({destination:'documentDirectory'}))});
test('reports local-copy failures without changing preferences',async()=>{(pick as jest.Mock).mockResolvedValue([{uri:'content://image',name:'bad.jpg'}]);(keepLocalCopy as jest.Mock).mockResolvedValue([{status:'error',copyError:'磁盘已满'}]);await expect(pickReaderBackground()).rejects.toThrow('磁盘已满')});
