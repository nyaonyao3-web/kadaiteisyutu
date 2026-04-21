document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEYS = {
    USER_RECORDS: 'kokoro_user_records',
    USER_DRAFT: 'kokoro_user_draft',
    STAFF_FEEDBACK: 'kokoro_staff_feedback'
  };

  const DEMO_USER = { userId: 'U001', userName: '山田 花子' };
  const DEMO_STAFF = { staffId: 'S001', staffName: '田中 職員' };

  setupScreenSwitcher();
  setupSingleSelect();
  setupUserForm();
  setupStaffForm();
  renderSessionLabels();
  populateStaffWeekOptions();
  renderStaffDataIfExists();

  function renderSessionLabels() {
    const currentUserDisplay = document.getElementById('currentUserDisplay');
    const currentStaffDisplay = document.getElementById('currentStaffDisplay');
    if (currentUserDisplay) currentUserDisplay.textContent = `${DEMO_USER.userName}（${DEMO_USER.userId}）`;
    if (currentStaffDisplay) currentStaffDisplay.textContent = `ログイン中の職員：${DEMO_STAFF.staffName}（${DEMO_STAFF.staffId}）`;
  }

  function setupScreenSwitcher() {
    const switchButtons = document.querySelectorAll('[data-screen-target]');
    const screens = document.querySelectorAll('.screen');
    const demoNavButtons = document.querySelectorAll('.demo-nav__btn');

    switchButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const targetId = button.dataset.screenTarget;
        if (!targetId) return;

        screens.forEach((screen) => {
          screen.classList.toggle('is-active', screen.id === targetId);
        });

        demoNavButtons.forEach((navBtn) => {
          navBtn.classList.toggle('is-active', navBtn.dataset.screenTarget === targetId);
        });

        if (targetId === 'screen-staff') {
          populateStaffWeekOptions();
          renderStaffDataIfExists();
          if (window.__kokoroStaffHooks?.loadFeedbackForSelection) {
            window.__kokoroStaffHooks.loadFeedbackForSelection();
          }
          if (window.__kokoroStaffHooks?.updateStaffActionState) {
            window.__kokoroStaffHooks.updateStaffActionState();
          }
        }
      });
    });
  }

  function setupSingleSelect() {
    const groups = document.querySelectorAll('.single-select, .segmented-control');
    groups.forEach((group) => {
      const inputName = group.dataset.name;
      if (!inputName) return;
      const hiddenInput = document.getElementById(inputName);
      if (!hiddenInput) return;
      const buttons = group.querySelectorAll('[data-value]');
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          buttons.forEach((btn) => btn.classList.remove('is-selected'));
          button.classList.add('is-selected');
          hiddenInput.value = button.dataset.value || '';
          hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
          clearFieldError(inputName);
        });
      });
    });
  }

  function reflectSelectedState(inputName, value) {
    if (!value) return;
    const group = document.querySelector(`[data-name="${inputName}"]`);
    if (!group) return;
    const buttons = group.querySelectorAll('[data-value]');
    buttons.forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.value === value);
    });
  }

  function setupUserForm() {
    const form = document.getElementById('userForm');
    if (!form) return;

    const recordDate = document.getElementById('recordDate');
    const mood = document.getElementById('mood');
    const condition = document.getElementById('condition');
    const bedtime = document.getElementById('bedtime');
    const wakeTime = document.getElementById('wakeTime');
    const sleepHours = document.getElementById('sleepHours');
    const breakfast = document.getElementById('breakfast');
    const lunch = document.getElementById('lunch');
    const dinner = document.getElementById('dinner');
    const steps = document.getElementById('steps');
    const freeNote = document.getElementById('freeNote');
    const btnSaveDraft = document.getElementById('btnSaveDraft');
    const btnSubmitRecord = document.getElementById('btnSubmitRecord');
    const btnAiSummary = document.getElementById('btnAiSummary');
    const aiSummaryResult = document.getElementById('aiSummaryResult');
    const aiSummaryText = document.getElementById('aiSummaryText');
    const countFreeNote = document.getElementById('count-freeNote');
    const userSubmitStatus = document.getElementById('userSubmitStatus');

    if (recordDate && !recordDate.value) recordDate.value = getTodayString();

    loadDraftIfExists();
    updateFreeNoteCount();
    updateUserActionState();

    ['recordDate','bedtime','wakeTime','sleepHours','steps','freeNote','mood','condition','breakfast','lunch','dinner'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        setSaveStatus('未保存');
        if (userSubmitStatus) userSubmitStatus.textContent = '未送信';
        updateUserActionState();
        updateFreeNoteCount();
      });
      el.addEventListener('change', () => {
        setSaveStatus('未保存');
        if (userSubmitStatus) userSubmitStatus.textContent = '未送信';
        clearFieldError(id);
        updateUserActionState();
        updateFreeNoteCount();
      });
    });

    if (btnSaveDraft) {
      btnSaveDraft.addEventListener('click', () => {
        const draft = collectUserFormData();
        localStorage.setItem(STORAGE_KEYS.USER_DRAFT, JSON.stringify(draft));
        setSaveStatus('一時保存済み');
        showToast('一時保存しました');
        updateUserActionState();
      });
    }

    if (btnAiSummary) {
      btnAiSummary.addEventListener('click', () => {
        const note = (freeNote?.value || '').trim();
        if (!note) {
          showToast('ひとことメモを入力してください');
          return;
        }
        const summary = generateAiSummaryFromNote(note);
        if (aiSummaryText) aiSummaryText.textContent = summary;
        if (aiSummaryResult) aiSummaryResult.hidden = false;
        showToast('文章を整理しました');
      });
    }

    if (btnSubmitRecord) {
      btnSubmitRecord.addEventListener('click', () => {
        clearUserErrors();
        const errors = validateUserForm();
        if (errors.length > 0) {
          showUserErrors(errors);
          showToast(errors[0].message);
          updateUserActionState();
          return;
        }
        const ok = window.confirm(`${DEMO_USER.userName}さんの記録として送信します。よろしいですか？`);
        if (!ok) return;
        const data = collectUserFormData();
        saveUserRecord(data);
        localStorage.removeItem(STORAGE_KEYS.USER_DRAFT);
        setSaveStatus('送信済み');
        if (userSubmitStatus) userSubmitStatus.textContent = '送信済み';
        populateStaffWeekOptions();
        renderStaffDataIfExists();
        showToast('記録を送信しました');
        updateUserActionState();
      });
    }

    function updateFreeNoteCount() {
      if (countFreeNote && freeNote) countFreeNote.textContent = `${freeNote.value.length} / 200`;
    }

    function hasAnyInput() {
      const values = [recordDate?.value,mood?.value,condition?.value,bedtime?.value,wakeTime?.value,sleepHours?.value,breakfast?.value,lunch?.value,dinner?.value,steps?.value,freeNote?.value];
      return values.some((value) => String(value || '').trim() !== '');
    }

    function updateUserActionState() {
      const requiredOk = !!recordDate?.value && !!mood?.value && !!condition?.value && !!sleepHours?.value && !!breakfast?.value && !!lunch?.value && !!dinner?.value;
      if (btnSubmitRecord) btnSubmitRecord.disabled = !requiredOk;
      if (btnSaveDraft) btnSaveDraft.disabled = !hasAnyInput();
      if (btnAiSummary) btnAiSummary.disabled = !(freeNote && freeNote.value.trim().length > 0);
    }

    function validateUserForm() {
      const errors = [];
      if (!recordDate?.value) errors.push({ field: 'recordDate', message: '日付を入力してください' });
      if (!mood?.value) errors.push({ field: 'mood', message: '気分を選択してください' });
      if (!condition?.value) errors.push({ field: 'condition', message: '体調を選択してください' });
      if (!sleepHours?.value) errors.push({ field: 'sleepHours', message: '睡眠時間を入力してください' });
      else if (Number(sleepHours.value) < 0 || Number(sleepHours.value) > 24) errors.push({ field: 'sleepHours', message: '睡眠時間は0〜24時間で入力してください' });
      if (!breakfast?.value) errors.push({ field: 'breakfast', message: '朝食を選択してください' });
      if (!lunch?.value) errors.push({ field: 'lunch', message: '昼食を選択してください' });
      if (!dinner?.value) errors.push({ field: 'dinner', message: '夕食を選択してください' });
      if (steps?.value && (Number(steps.value) < 0 || Number(steps.value) > 99999)) errors.push({ field: 'steps', message: '歩数は0〜99999で入力してください' });
      if (freeNote?.value && freeNote.value.length > 200) errors.push({ field: 'freeNote', message: 'ひとことメモは200文字以内で入力してください' });
      return errors;
    }

    function collectUserFormData() {
      return {
        userId: DEMO_USER.userId,
        userName: DEMO_USER.userName,
        recordDate: recordDate?.value || '',
        mood: mood?.value || '',
        condition: condition?.value || '',
        bedtime: bedtime?.value || '',
        wakeTime: wakeTime?.value || '',
        sleepHours: sleepHours?.value || '',
        breakfast: breakfast?.value || '',
        lunch: lunch?.value || '',
        dinner: dinner?.value || '',
        steps: steps?.value || '',
        freeNote: freeNote?.value || '',
        submittedAt: new Date().toISOString()
      };
    }

    function loadDraftIfExists() {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_DRAFT);
      if (!raw) return;
      try {
        const draft = JSON.parse(raw);
        if (recordDate && draft.recordDate) recordDate.value = draft.recordDate;
        if (bedtime && draft.bedtime) bedtime.value = draft.bedtime;
        if (wakeTime && draft.wakeTime) wakeTime.value = draft.wakeTime;
        if (sleepHours && draft.sleepHours) sleepHours.value = draft.sleepHours;
        if (steps && draft.steps) steps.value = draft.steps;
        if (freeNote && draft.freeNote) freeNote.value = draft.freeNote;
        if (mood && draft.mood) mood.value = draft.mood;
        if (condition && draft.condition) condition.value = draft.condition;
        if (breakfast && draft.breakfast) breakfast.value = draft.breakfast;
        if (lunch && draft.lunch) lunch.value = draft.lunch;
        if (dinner && draft.dinner) dinner.value = draft.dinner;
        reflectSelectedState('mood', draft.mood);
        reflectSelectedState('condition', draft.condition);
        reflectSelectedState('breakfast', draft.breakfast);
        reflectSelectedState('lunch', draft.lunch);
        reflectSelectedState('dinner', draft.dinner);
        setSaveStatus('一時保存済み');
      } catch (error) {
        console.error('下書きの読み込みに失敗しました', error);
      }
    }
  }

  function setupStaffForm() {
    const form = document.getElementById('staffForm');
    if (!form) return;

    const staffUserSelect = document.getElementById('staffUserSelect');
    const staffWeekSelect = document.getElementById('staffWeekSelect');
    const btnRefreshStaff = document.getElementById('btnRefreshStaff');
    const btnAiRefresh = document.getElementById('btnAiRefresh');
    const staffGoodPoint = document.getElementById('staffGoodPoint');
    const staffConcernPoint = document.getElementById('staffConcernPoint');
    const staffUserComment = document.getElementById('staffUserComment');
    const staffNextMemo = document.getElementById('staffNextMemo');
    const btnGenerateComment = document.getElementById('btnGenerateComment');
    const btnSaveStaffComment = document.getElementById('btnSaveStaffComment');
    const btnSendStaffComment = document.getElementById('btnSendStaffComment');
    const staffCommentStatus = document.getElementById('staffCommentStatus');

    const counterMap = [
      { input: staffGoodPoint, counterId: 'count-staffGoodPoint', max: 120 },
      { input: staffConcernPoint, counterId: 'count-staffConcernPoint', max: 120 },
      { input: staffUserComment, counterId: 'count-staffUserComment', max: 200 },
      { input: staffNextMemo, counterId: 'count-staffNextMemo', max: 200 }
    ];

    counterMap.forEach(({ input, counterId, max }) => {
      const counter = document.getElementById(counterId);
      if (!input || !counter) return;
      const updateCounter = () => { counter.textContent = `${input.value.length} / ${max}`; };
      input.addEventListener('input', () => {
        updateCounter();
        if (staffCommentStatus) staffCommentStatus.textContent = '未保存';
        updateStaffActionState();
        clearFieldError(input.id);
      });
      input.addEventListener('change', updateCounter);
      updateCounter();
    });

    staffUserSelect?.addEventListener('change', () => {
      clearFieldError('staffUserSelect');
      renderStaffDataIfExists();
      loadFeedbackForSelection();
      updateStaffActionState();
    });

    staffWeekSelect?.addEventListener('change', () => {
      clearFieldError('staffWeekSelect');
      renderStaffDataIfExists();
      loadFeedbackForSelection();
      updateStaffActionState();
    });

    if (btnRefreshStaff) {
      btnRefreshStaff.addEventListener('click', () => {
        clearFieldError('staffUserSelect');
        clearFieldError('staffWeekSelect');
        if (!staffUserSelect.value) {
          setFieldError('staffUserSelect', '利用者を選択してください');
          showToast('利用者を選択してください');
          return;
        }
        if (!staffWeekSelect.value) {
          setFieldError('staffWeekSelect', '対象週を選択してください');
          showToast('対象週を選択してください');
          return;
        }
        renderStaffDataIfExists();
        loadFeedbackForSelection();
        updateStaffActionState();
      });
    }

    if (btnAiRefresh) {
      btnAiRefresh.addEventListener('click', () => {
        renderStaffAiSummary();
        showToast('AI要約を更新しました');
        updateStaffActionState();
      });
    }

    if (btnGenerateComment) {
      btnGenerateComment.addEventListener('click', () => {
        clearStaffCommentErrors();
        if (!staffUserSelect.value) {
          setFieldError('staffUserSelect', '利用者を選択してください');
          showToast('利用者を選択してください');
          return;
        }
        if (!staffWeekSelect.value) {
          setFieldError('staffWeekSelect', '対象週を選択してください');
          showToast('対象週を選択してください');
          return;
        }
        const records = getFilteredStaffRecords();
        if (!records.length) {
          showToast('この週の記録がないため文案を作成できません');
          return;
        }
        const userName = getUserNameById(staffUserSelect.value);
        const draft = generateStaffCommentDraft(records, userName);
        if (staffGoodPoint && !staffGoodPoint.value.trim()) staffGoodPoint.value = draft.goodPoint;
        if (staffConcernPoint && !staffConcernPoint.value.trim()) staffConcernPoint.value = draft.concernPoint;
        if (staffUserComment && !staffUserComment.value.trim()) staffUserComment.value = draft.userComment;
        if (staffNextMemo && !staffNextMemo.value.trim()) staffNextMemo.value = draft.nextMemo;
        counterMap.forEach(({ input, counterId, max }) => {
          const counter = document.getElementById(counterId);
          if (!input || !counter) return;
          counter.textContent = `${input.value.length} / ${max}`;
        });
        if (staffCommentStatus) staffCommentStatus.textContent = '未保存';
        updateStaffActionState();
        showToast('コメント文案を作成しました');
      });
    }

    if (btnSaveStaffComment) {
      btnSaveStaffComment.addEventListener('click', () => {
        clearStaffCommentErrors();
        if (!validateStaffSelection()) return;
        const payload = collectStaffFeedback(false);
        saveStaffFeedback(payload);
        if (staffCommentStatus) staffCommentStatus.textContent = '保存済み';
        showToast('コメントを保存しました');
        updateStaffActionState();
      });
    }

    if (btnSendStaffComment) {
      btnSendStaffComment.addEventListener('click', () => {
        clearStaffCommentErrors();
        if (!validateStaffSelection()) return;
        const errors = [];
        if (!staffUserComment?.value.trim()) errors.push({ field: 'staffUserComment', message: '本人へのコメントを入力してください' });
        if (errors.length > 0) {
          errors.forEach(({ field, message }) => setFieldError(field, message));
          showToast(errors[0].message);
          updateStaffActionState();
          return;
        }
        const userName = getUserNameById(staffUserSelect.value);
        const ok = window.confirm(`${userName}さんへのコメントとして送信します。よろしいですか？`);
        if (!ok) return;
        const payload = collectStaffFeedback(true);
        saveStaffFeedback(payload);
        if (staffCommentStatus) staffCommentStatus.textContent = '送信済み';
        showToast('本人向けコメントを送信しました');
        updateStaffActionState();
      });
    }

    updateStaffActionState();
    loadFeedbackForSelection();

    window.__kokoroStaffHooks = { loadFeedbackForSelection, updateStaffActionState };

    function hasAnyCommentInput() {
      return [staffGoodPoint?.value, staffConcernPoint?.value, staffUserComment?.value, staffNextMemo?.value].some((value) => String(value || '').trim() !== '');
    }

    function updateStaffActionState() {
      const canSelect = !!staffUserSelect?.value && !!staffWeekSelect?.value;
      const records = canSelect ? getFilteredStaffRecords() : [];
      if (btnRefreshStaff) btnRefreshStaff.disabled = !canSelect;
      if (btnAiRefresh) btnAiRefresh.disabled = !canSelect;
      if (btnGenerateComment) btnGenerateComment.disabled = !(canSelect && records.length > 0);
      if (btnSaveStaffComment) btnSaveStaffComment.disabled = !(canSelect && hasAnyCommentInput());
      if (btnSendStaffComment) btnSendStaffComment.disabled = !(canSelect && !!staffUserComment?.value.trim());
    }

    function validateStaffSelection() {
      let valid = true;
      if (!staffUserSelect.value) { setFieldError('staffUserSelect', '利用者を選択してください'); valid = false; }
      if (!staffWeekSelect.value) { setFieldError('staffWeekSelect', '対象週を選択してください'); valid = false; }
      if (!valid) showToast('利用者と対象週を選択してください');
      return valid;
    }

    function collectStaffFeedback(isSent) {
      const { start, end } = parseWeekValue(staffWeekSelect.value);
      const existing = getStaffFeedbacks().find((item) => item.userId === staffUserSelect.value && item.weekStart === start && item.weekEnd === end);
      return {
        userId: staffUserSelect.value,
        userName: getUserNameById(staffUserSelect.value),
        weekValue: staffWeekSelect.value,
        weekStart: start,
        weekEnd: end,
        staffId: DEMO_STAFF.staffId,
        staffName: DEMO_STAFF.staffName,
        goodPoint: staffGoodPoint?.value.trim() || '',
        concernPoint: staffConcernPoint?.value.trim() || '',
        userComment: staffUserComment?.value.trim() || '',
        nextMemo: staffNextMemo?.value.trim() || '',
        savedAt: new Date().toISOString(),
        isSent,
        sentAt: isSent ? new Date().toISOString() : (existing?.sentAt || '')
      };
    }

    function loadFeedbackForSelection() {
      clearStaffCommentErrors();
      if (!staffUserSelect?.value || !staffWeekSelect?.value) {
        clearFeedbackFields();
        if (staffCommentStatus) staffCommentStatus.textContent = '未保存';
        return;
      }
      const { start, end } = parseWeekValue(staffWeekSelect.value);
      const existing = getStaffFeedbacks().find((item) => item.userId === staffUserSelect.value && item.weekStart === start && item.weekEnd === end);
      if (!existing) {
        clearFeedbackFields();
        if (staffCommentStatus) staffCommentStatus.textContent = '未保存';
        updateStaffActionState();
        return;
      }
      if (staffGoodPoint) staffGoodPoint.value = existing.goodPoint || '';
      if (staffConcernPoint) staffConcernPoint.value = existing.concernPoint || '';
      if (staffUserComment) staffUserComment.value = existing.userComment || '';
      if (staffNextMemo) staffNextMemo.value = existing.nextMemo || '';
      counterMap.forEach(({ input, counterId, max }) => {
        const counter = document.getElementById(counterId);
        if (!input || !counter) return;
        counter.textContent = `${input.value.length} / ${max}`;
      });
      if (staffCommentStatus) staffCommentStatus.textContent = existing.isSent ? '送信済み' : '保存済み';
      updateStaffActionState();
    }

    function clearFeedbackFields() {
      if (staffGoodPoint) staffGoodPoint.value = '';
      if (staffConcernPoint) staffConcernPoint.value = '';
      if (staffUserComment) staffUserComment.value = '';
      if (staffNextMemo) staffNextMemo.value = '';
      counterMap.forEach(({ input, counterId, max }) => {
        const counter = document.getElementById(counterId);
        if (!input || !counter) return;
        counter.textContent = `${input.value.length} / ${max}`;
      });
    }

    function clearStaffCommentErrors() {
      ['staffGoodPoint', 'staffConcernPoint', 'staffUserComment', 'staffNextMemo'].forEach((field) => clearFieldError(field));
    }
  }

  function renderStaffDataIfExists() {
    const staffUserSelect = document.getElementById('staffUserSelect');
    const staffWeekSelect = document.getElementById('staffWeekSelect');
    if (!staffUserSelect || !staffWeekSelect) return;
    if (!staffUserSelect.value || !staffWeekSelect.value) {
      renderStaffSummary([]);
      renderDailyRecords([]);
      renderStaffAiSummary([]);
      return;
    }
    const records = getFilteredStaffRecords();
    renderStaffSummary(records);
    renderDailyRecords(records);
    renderStaffAiSummary(records);
  }

  function renderStaffSummary(records = []) {
    const avgSleepValue = document.getElementById('avgSleepValue');
    const avgStepsValue = document.getElementById('avgStepsValue');
    const missedMealsValue = document.getElementById('missedMealsValue');
    const recordCountValue = document.getElementById('recordCountValue');
    if (!records.length) {
      if (avgSleepValue) avgSleepValue.textContent = '-';
      if (avgStepsValue) avgStepsValue.textContent = '-';
      if (missedMealsValue) missedMealsValue.textContent = '-';
      if (recordCountValue) recordCountValue.textContent = '0件';
      return;
    }
    const sleepValues = records.map((record) => Number(record.sleepHours)).filter((value) => !Number.isNaN(value));
    const stepValues = records.map((record) => Number(record.steps)).filter((value) => !Number.isNaN(value));
    let missedMeals = 0;
    records.forEach((record) => {
      if (record.breakfast === '食べていない') missedMeals += 1;
      if (record.lunch === '食べていない') missedMeals += 1;
      if (record.dinner === '食べていない') missedMeals += 1;
    });
    const avgSleep = sleepValues.length ? `${average(sleepValues).toFixed(1)}時間` : '-';
    const avgSteps = stepValues.length ? `${Math.round(average(stepValues)).toLocaleString()}歩` : '-';
    if (avgSleepValue) avgSleepValue.textContent = avgSleep;
    if (avgStepsValue) avgStepsValue.textContent = avgSteps;
    if (missedMealsValue) missedMealsValue.textContent = `${missedMeals}回`;
    if (recordCountValue) recordCountValue.textContent = `${records.length}件`;
  }

  function renderDailyRecords(records = []) {
    const container = document.getElementById('dailyRecordsContainer');
    if (!container) return;
    if (!records.length) {
      container.innerHTML = '<p class="helper-note">まだ記録がありません。</p>';
      return;
    }
    container.innerHTML = records.map((record) => `
      <details class="accordion-item">
        <summary>${formatDateJP(record.recordDate)} の記録</summary>
        <div class="accordion-body">
          <dl class="info-list">
            <div><dt>気分</dt><dd>${escapeHtml(record.mood || '-')}</dd></div>
            <div><dt>体調</dt><dd>${escapeHtml(record.condition || '-')}</dd></div>
            <div><dt>就寝</dt><dd>${escapeHtml(record.bedtime || '-')}</dd></div>
            <div><dt>起床</dt><dd>${escapeHtml(record.wakeTime || '-')}</dd></div>
            <div><dt>睡眠</dt><dd>${record.sleepHours ? `${escapeHtml(record.sleepHours)} 時間` : '-'}</dd></div>
            <div><dt>朝食</dt><dd>${escapeHtml(record.breakfast || '-')}</dd></div>
            <div><dt>昼食</dt><dd>${escapeHtml(record.lunch || '-')}</dd></div>
            <div><dt>夕食</dt><dd>${escapeHtml(record.dinner || '-')}</dd></div>
            <div><dt>歩数</dt><dd>${record.steps ? `${escapeHtml(String(record.steps))}歩` : '-'}</dd></div>
            <div><dt>メモ</dt><dd>${escapeHtml(record.freeNote || '-')}</dd></div>
          </dl>
        </div>
      </details>
    `).join('');
  }

  function renderStaffAiSummary(recordsParam) {
    const summaryBox = document.getElementById('staffAiSummary');
    if (!summaryBox) return;
    const staffUserSelect = document.getElementById('staffUserSelect');
    const staffWeekSelect = document.getElementById('staffWeekSelect');
    if (!staffUserSelect?.value || !staffWeekSelect?.value) {
      summaryBox.innerHTML = '<ul class="summary-bullets"><li>利用者と対象週を選んで表示を更新してください</li></ul>';
      return;
    }
    const records = Array.isArray(recordsParam) ? recordsParam : getFilteredStaffRecords();
    if (!records.length) {
      summaryBox.innerHTML = '<ul class="summary-bullets"><li>選択した週の記録はありません。</li></ul>';
      return;
    }
    const bullets = [];
    const sleepValues = records.map((record) => Number(record.sleepHours)).filter((value) => !Number.isNaN(value));
    const stepValues = records.map((record) => Number(record.steps)).filter((value) => !Number.isNaN(value));
    if (sleepValues.length) bullets.push(`平均睡眠時間は ${average(sleepValues).toFixed(1)} 時間でした。`);
    if (stepValues.length) bullets.push(`平均歩数は ${Math.round(average(stepValues)).toLocaleString()} 歩でした。`);
    const missedMeals = records.reduce((count, record) => count + (record.breakfast === '食べていない' ? 1 : 0) + (record.lunch === '食べていない' ? 1 : 0) + (record.dinner === '食べていない' ? 1 : 0), 0);
    bullets.push(`食事を取れなかった回数は合計 ${missedMeals} 回でした。`);
    const latestNote = [...records].reverse().find((record) => String(record.freeNote || '').trim() !== '');
    if (latestNote) bullets.push(`最新の自由記述では「${escapeHtml(latestNote.freeNote)}」という記録がありました。`);
    else bullets.push('自由記述は未入力の日が多い状況です。');
    summaryBox.innerHTML = `<ul class="summary-bullets">${bullets.map((text) => `<li>${text}</li>`).join('')}</ul>`;
  }

  function getFilteredStaffRecords() {
    const staffUserSelect = document.getElementById('staffUserSelect');
    const staffWeekSelect = document.getElementById('staffWeekSelect');
    if (!staffUserSelect || !staffWeekSelect) return [];
    const userId = staffUserSelect.value;
    const weekValue = staffWeekSelect.value;
    if (!userId || !weekValue) return [];
    const { start, end } = parseWeekValue(weekValue);
    return getUserRecords().filter((record) => record.userId === userId).filter((record) => isDateInRange(record.recordDate, start, end)).sort((a, b) => a.recordDate.localeCompare(b.recordDate));
  }

  function populateStaffWeekOptions() {
    const select = document.getElementById('staffWeekSelect');
    if (!select) return;
    const currentValue = select.value;
    const weekMap = new Map();
    const today = new Date();
    [-7, 0, 7].forEach((offsetDays) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offsetDays);
      const range = getWeekRangeFromDate(date);
      weekMap.set(`${range.start}_${range.end}`, range);
    });
    getUserRecords().forEach((record) => {
      if (!record.recordDate) return;
      const range = getWeekRangeFromDate(new Date(record.recordDate));
      weekMap.set(`${range.start}_${range.end}`, range);
    });
    const ranges = Array.from(weekMap.values()).sort((a, b) => a.start.localeCompare(b.start));
    select.innerHTML = '<option value="">選択してください</option>' + ranges.map((range) => {
      const value = `${range.start}_${range.end}`;
      const label = `${formatDateJP(range.start)}〜${formatDateJP(range.end)}`;
      return `<option value="${value}">${label}</option>`;
    }).join('');
    if ([...select.options].some((opt) => opt.value === currentValue)) select.value = currentValue;
  }

  function getWeekRangeFromDate(dateInput) {
    const date = new Date(dateInput);
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: toDateString(monday), end: toDateString(sunday) };
  }

  function toDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseWeekValue(value) {
    const [start, end] = String(value || '').split('_');
    return { start, end };
  }

  function isDateInRange(date, start, end) {
    if (!date || !start || !end) return false;
    return date >= start && date <= end;
  }

  function getUserRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_RECORDS) || '[]');
    } catch (error) {
      console.error('記録の読み込みに失敗しました', error);
      return [];
    }
  }

  function saveUserRecord(record) {
    const records = getUserRecords();
    const existingIndex = records.findIndex((item) => item.userId === record.userId && item.recordDate === record.recordDate);
    if (existingIndex >= 0) records[existingIndex] = record;
    else records.push(record);
    records.sort((a, b) => a.recordDate.localeCompare(b.recordDate));
    localStorage.setItem(STORAGE_KEYS.USER_RECORDS, JSON.stringify(records));
  }

  function getStaffFeedbacks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.STAFF_FEEDBACK) || '[]');
    } catch (error) {
      console.error('職員コメントの読み込みに失敗しました', error);
      return [];
    }
  }

  function saveStaffFeedback(feedback) {
    const list = getStaffFeedbacks();
    const existingIndex = list.findIndex((item) => item.userId === feedback.userId && item.weekStart === feedback.weekStart && item.weekEnd === feedback.weekEnd);
    if (existingIndex >= 0) list[existingIndex] = feedback;
    else list.push(feedback);
    list.sort((a, b) => `${a.userId}_${a.weekStart}`.localeCompare(`${b.userId}_${b.weekStart}`));
    localStorage.setItem(STORAGE_KEYS.STAFF_FEEDBACK, JSON.stringify(list));
  }

  function generateAiSummaryFromNote(note) {
    const trimmed = note.trim();
    return `今日の記録を整理しました：${trimmed}。職員はきっかけ・変化・回復につながった点を確認すると支援につなげやすいです。`;
  }

  function generateStaffCommentDraft(records, userName) {
    const moodSet = new Set(records.map((r) => r.mood));
    const lowMoodExists = records.some((r) => ['悪い', 'とても悪い'].includes(r.mood));
    const lowSleepExists = records.some((r) => Number(r.sleepHours) > 0 && Number(r.sleepHours) < 6);
    const missedMealExists = records.some((r) => r.breakfast === '食べていない' || r.lunch === '食べていない' || r.dinner === '食べていない');
    const goodPoint = missedMealExists ? '記録を続けて入力できており、ご自身の状態を振り返ろうとしている点が良いです。' : '食事や睡眠の記録が比較的安定しており、生活リズムを意識できている点が良いです。';
    let concernPoint = '大きな悪化は見られませんでした。';
    if (lowMoodExists) concernPoint = '気分が落ち込む日があり、負担が高まる場面の確認が必要です。';
    else if (lowSleepExists) concernPoint = '睡眠時間が短い日があり、疲れが残っていないか確認が必要です。';
    else if (missedMealExists) concernPoint = '食事を取れない日があり、体調や生活リズムへの影響が気になります。';
    let userComment = `${userName}さん、今週も記録を続けられたことがとても大切です。`;
    if (lowMoodExists || lowSleepExists || missedMealExists) userComment += '少し負担が高い日も見られたので、無理をしすぎず、落ち着けた行動や過ごし方を一緒に確認していきましょう。';
    else if (moodSet.has('良い') || moodSet.has('とても良い')) userComment += '比較的安定して過ごせている様子が見られました。この調子で無理のない範囲で続けていきましょう。';
    else userComment += '体調の変化を振り返りながら、無理のないペースで続けていきましょう。';
    const nextMemo = lowMoodExists ? '気分が下がった日のきっかけと、その後落ち着けた行動があったかを次回確認する。' : lowSleepExists ? '睡眠時間が短かった日の就寝前の過ごし方を次回確認する。' : missedMealExists ? '食事を取れなかった背景と、取りやすくする工夫を次回確認する。' : '安定して続けられている要因を次回も確認する。';
    return { goodPoint, concernPoint, userComment, nextMemo };
  }

  function getUserNameById(userId) {
    const option = document.querySelector(`#staffUserSelect option[value="${userId}"]`);
    if (option) return option.textContent.replace(/\s*（.*?）$/, '');
    if (userId === DEMO_USER.userId) return DEMO_USER.userName;
    return '利用者';
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function getTodayString() {
    return toDateString(new Date());
  }

  function formatDateJP(dateString) {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day) return dateString;
    return `${year}/${month}/${day}`;
  }

  function setSaveStatus(text) {
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) saveStatus.textContent = text;
  }

  function setFieldError(fieldName, message) {
    const errorEl = document.getElementById(`error-${fieldName}`);
    if (errorEl) errorEl.textContent = message;
  }

  function clearFieldError(fieldName) {
    const errorEl = document.getElementById(`error-${fieldName}`);
    if (errorEl) errorEl.textContent = '';
  }

  function clearUserErrors() {
    ['recordDate','mood','condition','sleepHours','breakfast','lunch','dinner','steps','freeNote'].forEach((field) => clearFieldError(field));
  }

  function showUserErrors(errors) {
    errors.forEach(({ field, message }) => setFieldError(field, message));
  }

  function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
});
