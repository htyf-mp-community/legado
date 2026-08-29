import {headerGeometry} from '../src/layout/capsule';
it('uses safe area when capsule is unavailable',()=>expect(headerGeometry(24,null,390)).toEqual({top:24,bottom:76,fullWidth:390}));
