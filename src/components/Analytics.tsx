import { useState } from "react"
import { motion } from "motion/react"
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Download, 
  Users,
  FileText,
  DollarSign,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Activity,
  Stethoscope,
  Award,
  Zap,
  Brain,
  Shield
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

interface MetricCardProps {
  title: string
  value: string | number
  baseline: string | number
  change: number
  changeType: 'increase' | 'decrease'
  trend: 'up' | 'down'
  icon: any
  description?: string
  color?: string
}

function MetricCard({ title, value, baseline, change, changeType, trend, icon: Icon, description, color = "blue" }: MetricCardProps) {
  const isPositive = (changeType === 'increase' && trend === 'up') || (changeType === 'decrease' && trend === 'down')
  
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          color === 'blue' ? 'bg-blue-100 text-blue-600' :
          color === 'green' ? 'bg-emerald-100 text-emerald-600' :
          color === 'purple' ? 'bg-purple-100 text-purple-600' :
          color === 'orange' ? 'bg-orange-100 text-orange-600' :
          'bg-slate-100 text-slate-600'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-semibold">{value}</div>
            <p className="text-xs text-muted-foreground">
              Baseline: {baseline}
            </p>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${
            isPositive ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

interface DashboardFiltersProps {
  onDateRangeChange: (range: any) => void
  onClinicianChange: (clinician: string) => void
  onExport: () => void
}

function DashboardFilters({ onDateRangeChange, onClinicianChange, onExport }: DashboardFiltersProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Select defaultValue="30days">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <Select defaultValue="all">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select clinician" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clinicians</SelectItem>
            <SelectItem value="dr-johnson">Dr. Johnson</SelectItem>
            <SelectItem value="dr-smith">Dr. Smith</SelectItem>
            <SelectItem value="np-williams">NP Williams</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Button onClick={onExport} variant="outline" size="sm" className="ml-auto">
        <Download className="w-4 h-4 mr-2" />
        Export PDF
      </Button>
    </div>
  )
}

function BillingCodingDashboard() {
  const revenueData = [
    { name: 'Mon', value: 2400, baseline: 2200 },
    { name: 'Tue', value: 2800, baseline: 2300 },
    { name: 'Wed', value: 3200, baseline: 2400 },
    { name: 'Thu', value: 2900, baseline: 2500 },
    { name: 'Fri', value: 3400, baseline: 2600 },
    { name: 'Sat', value: 1800, baseline: 1500 },
    { name: 'Sun', value: 1200, baseline: 1000 }
  ]
  
  const denialData = [
    { name: 'Week 1', denials: 12, total: 340 },
    { name: 'Week 2', denials: 8, total: 356 },
    { name: 'Week 3', denials: 15, total: 389 },
    { name: 'Week 4', denials: 6, total: 412 }
  ]

  const codeDistribution = [
    { name: '99213', value: 35, color: '#3b82f6' },
    { name: '99214', value: 28, color: '#10b981' },
    { name: '99215', value: 20, color: '#8b5cf6' },
    { name: '99212', value: 12, color: '#f59e0b' },
    { name: 'Other', value: 5, color: '#6b7280' }
  ]

  return (
    <div className="space-y-6">
      <DashboardFilters 
        onDateRangeChange={() => {}}
        onClinicianChange={() => {}}
        onExport={() => console.log('Export billing dashboard')}
      />
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Revenue This Month"
          value="$47,320"
          baseline="$42,150"
          change={12.3}
          changeType="increase"
          trend="up"
          icon={DollarSign}
          color="green"
          description="Target: $50,000"
        />
        <MetricCard
          title="Claims Processed"
          value="1,247"
          baseline="1,180"
          change={5.7}
          changeType="increase"
          trend="up"
          icon={FileText}
          color="blue"
          description="Avg processing time: 2.3 days"
        />
        <MetricCard
          title="Denial Rate"
          value="2.8%"
          baseline="4.2%"
          change={33.3}
          changeType="decrease"
          trend="down"
          icon={AlertTriangle}
          color="orange"
          description="Industry avg: 5.1%"
        />
        <MetricCard
          title="Revenue Per Visit"
          value="$187"
          baseline="$172"
          change={8.7}
          changeType="increase"
          trend="up"
          icon={Target}
          color="purple"
          description="Target: $195"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Revenue Trend</CardTitle>
            <CardDescription>Current vs Baseline Performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="baseline" stroke="#94a3b8" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CPT Code Distribution</CardTitle>
            <CardDescription>Most frequently used codes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={codeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {codeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Claims Denial Analysis</CardTitle>
            <CardDescription>Weekly denial rates and total claims</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={denialData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="right" dataKey="total" fill="#94a3b8" name="Total Claims" />
                <Bar yAxisId="left" dataKey="denials" fill="#ef4444" name="Denials" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function HealthOutcomesDashboard() {
  const outcomeData = [
    { name: 'Jan', satisfaction: 4.2, readmissions: 8, outcomes: 87 },
    { name: 'Feb', satisfaction: 4.4, readmissions: 6, outcomes: 89 },
    { name: 'Mar', satisfaction: 4.3, readmissions: 7, outcomes: 88 },
    { name: 'Apr', satisfaction: 4.6, readmissions: 5, outcomes: 91 },
    { name: 'May', satisfaction: 4.5, readmissions: 4, outcomes: 92 },
    { name: 'Jun', satisfaction: 4.7, readmissions: 3, outcomes: 94 }
  ]

  return (
    <div className="space-y-6">
      <DashboardFilters 
        onDateRangeChange={() => {}}
        onClinicianChange={() => {}}
        onExport={() => console.log('Export health outcomes dashboard')}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Patient Satisfaction"
          value="4.7/5.0"
          baseline="4.2/5.0"
          change={11.9}
          changeType="increase"
          trend="up"
          icon={Stethoscope}
          color="green"
          description="Above national avg"
        />
        <MetricCard
          title="Readmission Rate"
          value="3.2%"
          baseline="8.1%"
          change={60.5}
          changeType="decrease"
          trend="down"
          icon={Activity}
          color="blue"
          description="Target: <5%"
        />
        <MetricCard
          title="Care Quality Score"
          value="94.2"
          baseline="87.3"
          change={7.9}
          changeType="increase"
          trend="up"
          icon={Award}
          color="purple"
          description="Industry avg: 88.5"
        />
        <MetricCard
          title="Preventive Care %"
          value="86.7%"
          baseline="78.2%"
          change={10.9}
          changeType="increase"
          trend="up"
          icon={Shield}
          color="orange"
          description="Target: 90%"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Patient Satisfaction Trend</CardTitle>
            <CardDescription>Monthly satisfaction scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={outcomeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[3.8, 5.0]} />
                <Tooltip />
                <Line type="monotone" dataKey="satisfaction" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health Outcomes Index</CardTitle>
            <CardDescription>Composite quality score over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={outcomeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[80, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="outcomes" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function NoteQualityDashboard() {
  const qualityData = [
    { name: 'Week 1', completeness: 82, accuracy: 89, beauty: 156 },
    { name: 'Week 2', completeness: 85, accuracy: 91, beauty: 178 },
    { name: 'Week 3', completeness: 88, accuracy: 93, beauty: 194 },
    { name: 'Week 4', completeness: 90, accuracy: 95, beauty: 203 }
  ]

  return (
    <div className="space-y-6">
      <DashboardFilters 
        onDateRangeChange={() => {}}
        onClinicianChange={() => {}}
        onExport={() => console.log('Export note quality dashboard')}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Notes"
          value="1,423"
          baseline="1,287"
          change={10.6}
          changeType="increase"
          trend="up"
          icon={FileText}
          color="blue"
          description="This month"
        />
        <MetricCard
          title="Beautify Actions"
          value="731"
          baseline="645"
          change={13.3}
          changeType="increase"
          trend="up"
          icon={Zap}
          color="green"
          description="51% of all notes"
        />
        <MetricCard
          title="Note Completeness"
          value="90.2%"
          baseline="82.4%"
          change={9.5}
          changeType="increase"
          trend="up"
          icon={CheckCircle}
          color="purple"
          description="Target: 95%"
        />
        <MetricCard
          title="Avg Note Length"
          value="284 words"
          baseline="231 words"
          change={22.9}
          changeType="increase"
          trend="up"
          icon={Brain}
          color="orange"
          description="Industry avg: 195"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Note Quality Metrics</CardTitle>
            <CardDescription>Weekly completeness and accuracy scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={qualityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="completeness" stroke="#3b82f6" strokeWidth={2} name="Completeness %" />
                <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} name="Accuracy %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Beautify Usage</CardTitle>
            <CardDescription>Weekly beautify actions performed</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={qualityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="beauty" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StaffPerformanceDashboard() {
  const staffData = [
    { name: 'Dr. Johnson', notes: 145, accuracy: 94, efficiency: 87, revenue: 28450 },
    { name: 'Dr. Smith', notes: 132, accuracy: 91, efficiency: 92, revenue: 25680 },
    { name: 'NP Williams', notes: 98, accuracy: 89, efficiency: 88, revenue: 18920 },
    { name: 'Dr. Brown', notes: 156, accuracy: 96, efficiency: 85, revenue: 31200 }
  ]

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-600" />
          <span className="font-medium text-amber-800">Admin Access Required</span>
        </div>
        <p className="text-sm text-amber-700 mt-1">
          This dashboard contains sensitive staff performance data and is only accessible to administrators.
        </p>
      </div>

      <DashboardFilters 
        onDateRangeChange={() => {}}
        onClinicianChange={() => {}}
        onExport={() => console.log('Export staff performance dashboard')}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Team Productivity"
          value="127%"
          baseline="100%"
          change={27.0}
          changeType="increase"
          trend="up"
          icon={TrendingUp}
          color="green"
          description="Above target"
        />
        <MetricCard
          title="Avg Coding Accuracy"
          value="92.5%"
          baseline="88.1%"
          change={5.0}
          changeType="increase"
          trend="up"
          icon={Target}
          color="blue"
          description="Target: 95%"
        />
        <MetricCard
          title="Documentation Speed"
          value="8.3 min/note"
          baseline="11.2 min/note"
          change={25.9}
          changeType="decrease"
          trend="down"
          icon={Clock}
          color="purple"
          description="Industry avg: 12 min"
        />
        <MetricCard
          title="Compliance Score"
          value="96.8%"
          baseline="92.4%"
          change={4.8}
          changeType="increase"
          trend="up"
          icon={Award}
          color="orange"
          description="Target: 98%"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Performance Comparison</CardTitle>
          <CardDescription>Individual clinician metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={staffData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="accuracy" fill="#3b82f6" name="Accuracy %" />
              <Bar yAxisId="left" dataKey="efficiency" fill="#10b981" name="Efficiency %" />
              <Bar yAxisId="right" dataKey="notes" fill="#8b5cf6" name="Notes Count" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

interface AnalyticsProps {
  userRole?: 'admin' | 'user'
}

export function Analytics({ userRole = 'user' }: AnalyticsProps) {
  const [activeTab, setActiveTab] = useState('billing')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into your clinical documentation and billing performance
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Last updated: {new Date().toLocaleDateString()}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Billing & Coding
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Health Outcomes
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Note Quality
          </TabsTrigger>
          <TabsTrigger 
            value="staff" 
            disabled={userRole !== 'admin'}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Staff Performance
            {userRole !== 'admin' && <Shield className="w-3 h-3 ml-1" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="space-y-6">
          <BillingCodingDashboard />
        </TabsContent>

        <TabsContent value="outcomes" className="space-y-6">
          <HealthOutcomesDashboard />
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <NoteQualityDashboard />
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <StaffPerformanceDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
