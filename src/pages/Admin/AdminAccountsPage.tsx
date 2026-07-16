import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  loadAdminAccounts,
  saveAdminAccount,
  deleteAdminAccount,
  type AdminAccount,
} from '@/lib/admin-projects';

const defaultPermissions = {
  manage_projects: true,
  manage_materials: true,
  manage_market: true,
  manage_admins: false,
};

export function AdminAccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'admin' as 'super_admin' | 'admin',
    permissions: { ...defaultPermissions },
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await loadAdminAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load admin accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: AdminAccount) => {
    setEditingId(account.id);
    setNewAccount(false);
    setFormData({
      username: account.username,
      password: account.password,
      role: account.role,
      permissions: account.permissions || { ...defaultPermissions },
    });
  };

  const handleNew = () => {
    setEditingId(null);
    setNewAccount(true);
    setFormData({
      username: '',
      password: '',
      role: 'admin',
      permissions: { ...defaultPermissions },
    });
  };

  const handleSave = async () => {
    if (!formData.username || !formData.password) {
      alert('请填写用户名和密码');
      return;
    }
    try {
      const account: AdminAccount = {
        id: editingId || `admin_${Date.now()}`,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        permissions: formData.permissions,
      };
      await saveAdminAccount(account);
      setEditingId(null);
      setNewAccount(false);
      await loadAccounts();
    } catch (err) {
      console.error('Failed to save admin account:', err);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此管理员账号吗？')) return;
    try {
      await deleteAdminAccount(id);
      await loadAccounts();
    } catch (err) {
      console.error('Failed to delete admin account:', err);
      alert('删除失败');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewAccount(false);
  };

  const togglePermission = (key: keyof typeof defaultPermissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">管理员账号管理</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理管理员账号和权限设置
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <i className="fa-solid fa-plus" />
          添加账号
        </Button>
      </div>

      {(editingId || newAccount) && (
        <Card>
          <CardHeader>
            <CardTitle>{newAccount ? '添加新账号' : '编辑账号'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input
                  value={formData.username}
                  onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="请输入用户名"
                />
              </div>
              <div className="space-y-2">
                <Label>密码</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="请输入密码"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={formData.role}
                onValueChange={(v: 'super_admin' | 'admin') => setFormData(prev => ({ ...prev, role: v }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">超级管理员</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>权限设置</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.permissions.manage_projects}
                    onCheckedChange={() => togglePermission('manage_projects')}
                  />
                  <Label className="text-sm">项目管理</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.permissions.manage_materials}
                    onCheckedChange={() => togglePermission('manage_materials')}
                  />
                  <Label className="text-sm">材料管理</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.permissions.manage_market}
                    onCheckedChange={() => togglePermission('manage_market')}
                  />
                  <Label className="text-sm">市场管理</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.permissions.manage_admins}
                    onCheckedChange={() => togglePermission('manage_admins')}
                  />
                  <Label className="text-sm">管理员管理</Label>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>保存</Button>
              <Button variant="outline" onClick={handleCancel}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>账号列表 ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>权限</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(account => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.username}</TableCell>
                  <TableCell>
                    <span className={account.role === 'super_admin' ? 'text-purple-400' : 'text-blue-400'}>
                      {account.role === 'super_admin' ? '超级管理员' : '管理员'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {account.permissions?.manage_projects && <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">项目</span>}
                      {account.permissions?.manage_materials && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">材料</span>}
                      {account.permissions?.manage_market && <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">市场</span>}
                      {account.permissions?.manage_admins && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">管理员</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300"
                        onClick={() => handleEdit(account)}
                      >
                        <i className="fa-solid fa-pen mr-1" />
                        编辑
                      </Button>
                      {account.role !== 'super_admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                          onClick={() => handleDelete(account.id)}
                        >
                          <i className="fa-solid fa-trash mr-1" />
                          删除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminAccountsPage;
