-- Find + delete ID everywhere: 6999a6f3-2d7f-487d-af99-e947162ebbd8
-- DB: recruitment_db @ localhost (user: admin)

-- ========== STEP 1: FIND (run first) ==========
\set id '6999a6f3-2d7f-487d-af99-e947162ebbd8'

SELECT 'users' AS tbl, user_id AS pk, email AS info FROM users WHERE user_id = :'id'
UNION ALL SELECT 'candidates', candidate_id, user_id FROM candidates WHERE candidate_id = :'id' OR user_id = :'id'
UNION ALL SELECT 'applications', app_id, status::text FROM applications WHERE app_id = :'id' OR candidate_id = :'id' OR job_id = :'id' OR cv_id = :'id'
UNION ALL SELECT 'interviews', interview_id, status::text FROM interviews WHERE interview_id = :'id' OR application_id = :'id' OR candidate_id = :'id' OR job_id = :'id'
UNION ALL SELECT 'interview_messages', message_id, interview_id FROM interview_messages WHERE message_id = :'id' OR interview_id = :'id'
UNION ALL SELECT 'interview_reports', report_id, interview_id FROM interview_reports WHERE report_id = :'id' OR interview_id = :'id'
UNION ALL SELECT 'cv_versions', cv_id, candidate_id FROM cv_versions WHERE cv_id = :'id' OR candidate_id = :'id'
UNION ALL SELECT 'notifications', notification_id, type FROM notifications WHERE notification_id = :'id' OR user_id = :'id' OR reference_id = :'id'
UNION ALL SELECT 'job_offers', job_id, title FROM job_offers WHERE job_id = :'id'
UNION ALL SELECT 'rag_conversations', conversation_id, job_id FROM rag_conversations WHERE conversation_id = :'id' OR job_id = :'id' OR recruiter_id = :'id'
UNION ALL SELECT 'rag_messages', message_id, conversation_id FROM rag_messages WHERE message_id = :'id' OR conversation_id = :'id';

-- ========== STEP 2: DELETE (only after you check step 1) ==========
BEGIN;

\set id '6999a6f3-2d7f-487d-af99-e947162ebbd8'

DELETE FROM interview_messages
WHERE interview_id IN (
  SELECT interview_id FROM interviews
  WHERE interview_id = :'id'
     OR application_id = :'id'
     OR candidate_id = :'id'
     OR job_id = :'id'
);

DELETE FROM interview_reports
WHERE interview_id IN (
  SELECT interview_id FROM interviews
  WHERE interview_id = :'id'
     OR application_id = :'id'
     OR candidate_id = :'id'
     OR job_id = :'id'
);

DELETE FROM interviews
WHERE interview_id = :'id'
   OR application_id = :'id'
   OR candidate_id = :'id'
   OR job_id = :'id';

DELETE FROM notifications
WHERE reference_id = :'id'
   OR user_id = :'id'
   OR notification_id = :'id';

DELETE FROM rag_messages
WHERE conversation_id IN (
  SELECT conversation_id FROM rag_conversations
  WHERE conversation_id = :'id' OR job_id = :'id' OR recruiter_id = :'id'
);

DELETE FROM rag_conversations
WHERE conversation_id = :'id'
   OR job_id = :'id'
   OR recruiter_id = :'id';

DELETE FROM applications
WHERE app_id = :'id'
   OR candidate_id = :'id'
   OR job_id = :'id'
   OR cv_id = :'id';

DELETE FROM cv_versions
WHERE cv_id = :'id'
   OR candidate_id = :'id';

DELETE FROM candidates
WHERE candidate_id = :'id'
   OR user_id = :'id';

DELETE FROM users
WHERE user_id = :'id';

DELETE FROM job_offers
WHERE job_id = :'id';

COMMIT;
