import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import DailyReportPage from './pages/daily-report';
import DailyReportFormPage from './pages/daily-report/form';
import DailyReportDetailPage from './pages/daily-report/detail';
import WeeklyReportPage from './pages/weekly-report';
import WeeklyReportDetailPage from './pages/weekly-report/detail';
import MonthlyReportPage from './pages/monthly-report';
import MonthlyReportDetailPage from './pages/monthly-report/detail';
import WeeklyDepartmentDetailPage from './pages/weekly-report/department-detail';
import MonthlyDepartmentDetailPage from './pages/monthly-report/department-detail';
import StatsPage from './pages/stats';
import ReportArchivePage from './pages/report-archive';
import TaskPoolPage from './pages/task-pool';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DailyReportPage />} />
        <Route path="daily-report" element={<DailyReportPage />} />
        <Route path="daily-report/new" element={<DailyReportFormPage />} />
        <Route path="daily-report/:id" element={<DailyReportDetailPage />} />
        <Route path="daily-report/:id/edit" element={<DailyReportFormPage />} />
        <Route path="weekly-report" element={<WeeklyReportPage />} />
        <Route path="weekly-report/department/:id" element={<WeeklyDepartmentDetailPage />} />
        <Route path="weekly-report/:id" element={<WeeklyReportDetailPage />} />
        <Route path="monthly-report" element={<MonthlyReportPage />} />
        <Route path="monthly-report/department/:id" element={<MonthlyDepartmentDetailPage />} />
        <Route path="monthly-report/:id" element={<MonthlyReportDetailPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="report-archive" element={<ReportArchivePage />} />
        <Route path="task-pool" element={<TaskPoolPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
