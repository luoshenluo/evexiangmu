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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        <div className="text-[#A0A0A0]">加载中...</div>
      </div>
    );
  }

  const editForm = (editingId || newAccount) && (
    <Card className="bg-[#2C2C2C] border-[#3A3A3A]">
      <CardHeader>
        <CardTitle className="text-white">{newAccount ? '添加新账号' : '编辑账号'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-white/80">用户名</Label>
            <Input
              value={formData.username}
              onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="请输入用户名"
              className="bg-[#1E1E1E] border-[#3A3A3A] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">密码</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="请输入密码"
              className="bg-[#1E1E1E] border-[#3A3A3A] text-white"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-white/80">角色</Label>
          <Select
            value={formData.role}
            onValueChange={(v: 'super_admin' | 'admin') => setFormData(prev => ({ ...prev, role: v }))}
          >
            <SelectTrigger className="w-48 bg-[#1E1E1E] border-[#3A3A3A] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#2C2C2C] border-[#3A3A3A] text-white">
              <SelectItem value="super_admin">超级管理员</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-white/80">权限设置</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.permissions.manage_projects}
                onCheckedChange={() => togglePermission('manage_projects')}
                className="border-[#3A3A3A]"
              />
              <Label className="text-sm text-white/80">项目管理</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.permissions.manage_materials}
                onCheckedChange={() => togglePermission('manage_materials')}
                className="border-[#3A3A3A]"
              />
              <Label className="text-sm text-white/80">材料管理</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.permissions.manage_market}
                onCheckedChange={() => togglePermission('manage_market')}
                className="border-[#3A3A3A]"
              />
              <Label className="text-sm text-white/80">市场管理</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.permissions.manage_admins}
                onCheckedChange={() => togglePermission('manage_admins')}
                className="border-[#3A3A3A]"
              />
              <Label className="text-sm text-white/80">管理员管理</Label>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">保存</Button>
          <Button variant="outline" onClick={handleCancel} className="border-[#3A3A3A] text-white hover:bg-[#3A3A3A]">取消</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-4 md:p-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">管理员账号管理</h2>
          <p className="text-sm text-[#A0A0A0] mt-1">
            管理管理员账号和权限设置
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">添加账号</span>
        </Button>
      </div>

      {/* Edit Form */}
      {editForm}

      {/* Desktop Table */}
      <Card className="bg-[#2C2C2C] border-[#3A3A3A] hidden md:block">
        <CardHeader>
          <CardTitle className="text-white">账号列表 ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[#3A3A3A]">
                <TableHead className="text-[#A0A0A0]">用户名</TableHead>
                <TableHead className="text-[#A0A0A0]">角色</TableHead>
                <TableHead className="text-[#A0A0A0] hidden lg:table-cell">权限</TableHead>
                <TableHead className="text-right text-[#A0A0A0]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(account => (
                <TableRow key={account.id} className="border-[#3A3A3A]">
                  <TableCell className="font-medium text-white">{account.username}</TableCell>
                  <TableCell>
                    <span className={account.role === 'super_admin' ? 'text-[#A78BFA]' : 'text-[#60A5FA]'}>
                      {account.role === 'super_admin' ? '超级管理员' : '管理员'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {account.permissions?.manage_projects && <span className="text-xs bg-[#7C3AED]/20 text-[#A78BFA] px-2 py-0.5 rounded">项目</span>}
                      {account.permissions?.manage_materials && <span className="text-xs bg-[#3B82F6]/20 text-[#60A5FA] px-2 py-0.5 rounded">材料</span>}
                      {account.permissions?.manage_market && <span className="text-xs bg-[#10B981]/20 text-[#34D399] px-2 py-0.5 rounded">市场</span>}
                      {account.permissions?.manage_admins && <span className="text-xs bg-[#EF4444]/20 text-[#F87171] px-2 py-0.5 rounded">管理员</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-[#60A5FA] hover:text-[#93C5FD] hover:bg-[#3B82F6]/10"
                        onClick={() => handleEdit(account)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        编辑
                      </Button>
                      {account.role !== 'super_admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-[#F87171] hover:text-[#FCA5A5] hover:bg-[#EF4444]/10"
                          onClick={() => handleDelete(account.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {accounts.map(account => (
          <Card key={account.id} className="bg-[#2C2C2C] border-[#3A3A3A]">
            {editingId === account.id ? (
              /* Inline edit mode inside card */
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">用户名</Label>
                  <Input
                    value={formData.username}
                    onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="请输入用户名"
                    className="bg-[#1E1E1E] border-[#3A3A3A] text-white h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">密码</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="请输入密码"
                    className="bg-[#1E1E1E] border-[#3A3A3A] text-white h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">角色</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v: 'super_admin' | 'admin') => setFormData(prev => ({ ...prev, role: v }))}
                  >
                    <SelectTrigger className="bg-[#1E1E1E] border-[#3A3A3A] text-white h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2C2C2C] border-[#3A3A3A] text-white">
                      <SelectItem value="super_admin">超级管理员</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">权限设置</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.permissions.manage_projects}
                        onCheckedChange={() => togglePermission('manage_projects')}
                        className="border-[#3A3A3A]"
                      />
                      <Label className="text-sm text-white/80">项目管理</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.permissions.manage_materials}
                        onCheckedChange={() => togglePermission('manage_materials')}
                        className="border-[#3A3A3A]"
                      />
                      <Label className="text-sm text-white/80">材料管理</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.permissions.manage_market}
                        onCheckedChange={() => togglePermission('manage_market')}
                        className="border-[#3A3A3A]"
                      />
                      <Label className="text-sm text-white/80">市场管理</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.permissions.manage_admins}
                        onCheckedChange={() => togglePermission('manage_admins')}
                        className="border-[#3A3A3A]"
                      />
                      <Label className="text-sm text-white/80">管理员管理</Label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white h-11">保存</Button>
                  <Button variant="outline" onClick={handleCancel} className="flex-1 border-[#3A3A3A] text-white hover:bg-[#3A3A3A] h-11">取消</Button>
                </div>
              </CardContent>
            ) : (
              /* Summary view */
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="text-base font-medium text-white">{account.username}</div>
                    <div>
                      <span
                        className={cn(
                          'inline-block text-xs px-2 py-0.5 rounded',
                          account.role === 'super_admin'
                            ? 'bg-[#7C3AED]/20 text-[#A78BFA]'
                            : 'bg-[#3B82F6]/20 text-[#60A5FA]'
                        )}
                      >
                        {account.role === 'super_admin' ? '超级管理员' : '管理员'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {account.permissions?.manage_projects && (
                        <span className="text-xs bg-[#7C3AED]/20 text-[#A78BFA] px-2 py-0.5 rounded">项目</span>
                      )}
                      {account.permissions?.manage_materials && (
                        <span className="text-xs bg-[#3B82F6]/20 text-[#60A5FA] px-2 py-0.5 rounded">材料</span>
                      )}
                      {account.permissions?.manage_market && (
                        <span className="text-xs bg-[#10B981]/20 text-[#34D399] px-2 py-0.5 rounded">市场</span>
                      )}
                      {account.permissions?.manage_admins && (
                        <span className="text-xs bg-[#EF4444]/20 text-[#F87171] px-2 py-0.5 rounded">管理员</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs text-[#60A5FA] hover:text-[#93C5FD] hover:bg-[#3B82F6]/10"
                      onClick={() => handleEdit(account)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      编辑
                    </Button>
                    {account.role !== 'super_admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-[#F87171] hover:text-[#FCA5A5] hover:bg-[#EF4444]/10"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        删除
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default AdminAccountsPage;
