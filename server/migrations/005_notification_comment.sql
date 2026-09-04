-- 通知关联评论：评论类通知弹窗可展示评论正文与截图
ALTER TABLE notifications ADD COLUMN comment_id INT NULL AFTER ticket_id;
