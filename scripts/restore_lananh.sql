BEGIN TRANSACTION;

BEGIN TRY
    -- 1. Khôi phục ca ngày 04/11/2026 (Shift ID: 852)
    UPDATE [dbo].[shift_registrations]
    SET [status] = 'COMPLETED'
    WHERE [id] = 852 AND [user_id] = 139;

    -- Điểm danh login_session cho 04/11 nếu chưa có
    IF NOT EXISTS (SELECT 1 FROM [dbo].[login_sessions] WHERE [shift_registration_id] = 852)
    BEGIN
        INSERT INTO [dbo].[login_sessions] 
            ([user_id], [shift_registration_id], [login_time], [logout_time], [is_late], [late_minutes], [auto_marked_absent], [ip_address], [created_at])
        VALUES 
            (139, 852, '2026-11-04 13:00:00.000', '2026-11-04 22:00:00.000', 0, 0, 0, '127.0.0.1', '2026-11-04 13:00:00.000');
    END

    -- Tạo DailyReport cho 04/11
    DECLARE @ReportId_04 INT;

    INSERT INTO [dbo].[daily_reports]
        ([user_id], [shift_registration_id], [report_date], [shift_type], 
         [fb_links], [fb_supplement_links], [thread_links], [comment_drive_link], 
         [female_content_links], [viral_post_links], [submitted_at], [updated_at], 
         [post_tags], [viral_proposals], [end_fb_count], [end_snapshot_at], [end_thread_count], [threshold_met])
    VALUES
        (139, 852, '2026-11-04', 'EVENING',
         N'["https://www.facebook.com/share/p/1CHKUpCSgZ/?mibextid=wwXIfr","https://www.facebook.com/share/p/1MZfoGcZxy/?mibextid=wwXIfr","https://www.facebook.com/share/p/17rfKpfxw1/?mibextid=wwXIfr","https://www.facebook.com/share/p/1PSCu6jrET/?mibextid=wwXIfr","https://www.facebook.com/share/p/16LSyvr1ivX/?mibextid=wwXIfr","https://www.facebook.com/share/p/1HQK56D2R5/?mibextid=wwXIfr","https://www.facebook.com/share/p/14z7HmeeGXS/?mibextid=wwXIfr","https://www.facebook.com/share/p/1JTMXDFSM4/?mibextid=wwXIfr","https://www.facebook.com/share/p/1Jw2zzNAsk/?mibextid=wwXIfr","https://www.facebook.com/share/p/19rGy6UHYa/?mibextid=wwXIfr","https://www.facebook.com/share/p/1KK5vVkZRE/?mibextid=wwXIfr","https://www.facebook.com/share/p/1FXof5Wypj/?mibextid=wwXIfr"]',
         N'[]',
         N'["https://www.threads.com/share/BAYJQ4N7Fs","https://www.threads.com/share/BAdOmxNOiy","https://www.threads.com/share/BAc2nkqVFv","https://www.threads.com/share/BBuZ33S0eN","https://www.threads.com/share/BAOaRRko33","https://www.threads.com/share/BAn5OCeDnf"]',
         N'https://drive.google.com/drive/folders/1qaVWfT_Zksq-O7_0sEJxScd2Tes0wlwM',
         N'[]',
         N'[]',
         '2026-11-04 15:30:00.000',
         '2026-11-06 09:06:36.204',
         N'{}',
         N'[]',
         12,
         '2026-11-04 15:30:00.000',
         6,
         1);

    SET @ReportId_04 = SCOPE_IDENTITY();

    -- Tạo QC review PASS cho 04/11
    INSERT INTO [dbo].[qc_reviews]
        ([daily_report_id], [reviewer_id], [fb_approved], [thread_approved], [comment_approved],
         [result], [feedback], [reviewed_at], [created_at], [updated_at], [invalid_links])
    VALUES
        (@ReportId_04, 4, 12, 6, 50,
         'PASS', N'nhớ rep điều hướng FT', '2026-11-06 09:06:36.204', '2026-11-06 09:06:36.204', '2026-11-06 09:06:36.204', N'[]');

    PRINT 'Đã khôi phục thành công báo cáo ngày 04/11/2026 (Report ID: ' + CAST(@ReportId_04 AS NVARCHAR(20)) + ')';

    -- 2. Khôi phục ca ngày 05/11/2026 (Shift ID: 853)
    UPDATE [dbo].[shift_registrations]
    SET [status] = 'COMPLETED'
    WHERE [id] = 853 AND [user_id] = 139;

    -- Điểm danh login_session cho 05/11 nếu chưa có
    IF NOT EXISTS (SELECT 1 FROM [dbo].[login_sessions] WHERE [shift_registration_id] = 853)
    BEGIN
        INSERT INTO [dbo].[login_sessions] 
            ([user_id], [shift_registration_id], [login_time], [logout_time], [is_late], [late_minutes], [auto_marked_absent], [ip_address], [created_at])
        VALUES 
            (139, 853, '2026-11-05 13:00:00.000', '2026-11-05 22:00:00.000', 0, 0, 0, '127.0.0.1', '2026-11-05 13:00:00.000');
    END

    -- Tạo DailyReport cho 05/11
    DECLARE @ReportId_05 INT;

    INSERT INTO [dbo].[daily_reports]
        ([user_id], [shift_registration_id], [report_date], [shift_type], 
         [fb_links], [fb_supplement_links], [thread_links], [comment_drive_link], 
         [female_content_links], [viral_post_links], [submitted_at], [updated_at], 
         [post_tags], [viral_proposals], [end_fb_count], [end_snapshot_at], [end_thread_count], [threshold_met])
    VALUES
        (139, 853, '2026-11-05', 'EVENING',
         N'["https://www.facebook.com/share/p/1E3mPgvRAw/?mibextid=wwXIfr","https://www.facebook.com/share/p/1EXpBAL9p8/?mibextid=wwXIfr","https://www.facebook.com/share/p/1ELM1w5fYM/?mibextid=wwXIfr","https://www.facebook.com/share/p/1Fi9ZiMyfG/?mibextid=wwXIfr","https://www.facebook.com/share/p/1JB1caLbeS/?mibextid=wwXIfr","https://www.facebook.com/share/p/1HTGoAFAnH/?mibextid=wwXIfr","https://www.facebook.com/share/p/1CUhXY6bDB/?mibextid=wwXIfr","https://www.facebook.com/share/p/1FUhFHRWT4/?mibextid=wwXIfr","https://www.facebook.com/share/p/1CJ4i5kPiR/?mibextid=wwXIfr","https://www.facebook.com/share/p/1J4MG45yeV/?mibextid=wwXIfr","https://www.facebook.com/share/p/1FKVXqjTnA/?mibextid=wwXIfr","https://www.facebook.com/share/p/1LxSoaHgWK/?mibextid=wwXIfr"]',
         N'[]',
         N'["https://www.threads.com/share/BAYcySQYRx","https://www.threads.com/share/BBrh2U3uoK","https://www.threads.com/share/BAYfOOubIB","https://www.threads.com/share/BAa4VXYXMO","https://www.threads.com/share/BATXIh2zrR","https://www.threads.com/share/BAXTLyhp_G"]',
         N'https://drive.google.com/drive/folders/1qaVWfT_Zksq-O7_0sEJxScd2Tes0wlwM',
         N'[]',
         N'[]',
         '2026-11-05 15:30:00.000',
         '2026-11-06 09:07:02.387',
         N'{}',
         N'[]',
         12,
         '2026-11-05 15:30:00.000',
         6,
         1);

    SET @ReportId_05 = SCOPE_IDENTITY();

    -- Tạo QC review PASS cho 05/11
    INSERT INTO [dbo].[qc_reviews]
        ([daily_report_id], [reviewer_id], [fb_approved], [thread_approved], [comment_approved],
         [result], [feedback], [reviewed_at], [created_at], [updated_at], [invalid_links])
    VALUES
        (@ReportId_05, 4, 12, 6, 50,
         'PASS', N'nhớ rep điều hướng FT. GẮN BÀI NỔI BẬT', '2026-11-06 09:07:02.387', '2026-11-06 09:07:02.387', '2026-11-06 09:07:02.387', N'[]');

    PRINT 'Đã khôi phục thành công báo cáo ngày 05/11/2026 (Report ID: ' + CAST(@ReportId_05 AS NVARCHAR(20)) + ')';

    COMMIT TRANSACTION;
    PRINT 'SUCCESS: Toàn bộ dữ liệu báo cáo tuần 45 đã được khôi phục thành công!';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

